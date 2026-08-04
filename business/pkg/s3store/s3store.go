// Package s3store is a thin S3-compatible object-store client (MinIO dev → R2/AWS
// S3 prod — only the endpoint/credentials change). Used to persist Knowledge Base
// source files; objects are keyed by {tenantId}/{kbId}/{sourceId}/{filename} by
// callers (this package stays key-agnostic).
package s3store

import (
	"context"
	"fmt"
	"io"
	"os"
	"strconv"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// Config holds the connection settings for the object store.
type Config struct {
	Endpoint  string
	Bucket    string
	AccessKey string
	SecretKey string
	Region    string
	UseSSL    bool
}

// ConfigFromEnv reads the config from S3_* env vars. ok=false when no endpoint is
// configured, so callers can treat the object store as optional (dev without S3).
func ConfigFromEnv() (Config, bool) {
	endpoint := os.Getenv("S3_ENDPOINT")
	if endpoint == "" {
		return Config{}, false
	}
	useSSL, _ := strconv.ParseBool(os.Getenv("S3_USE_SSL"))
	region := os.Getenv("S3_REGION")
	if region == "" {
		region = "us-east-1"
	}
	bucket := os.Getenv("S3_BUCKET")
	if bucket == "" {
		bucket = "watink-knowledge"
	}
	return Config{
		Endpoint:  endpoint,
		Bucket:    bucket,
		AccessKey: os.Getenv("S3_ACCESS_KEY"),
		SecretKey: os.Getenv("S3_SECRET_KEY"),
		Region:    region,
		UseSSL:    useSSL,
	}, true
}

// Store is a bucket-scoped S3-compatible client.
type Store struct {
	client   *minio.Client
	bucket   string
	endpoint string
	region   string
	useSSL   bool
}

// Describe returns the non-sensitive store configuration (never the credentials),
// for a superadmin storage-status panel.
func (s *Store) Describe() map[string]any {
	return map[string]any{
		"endpoint": s.endpoint,
		"bucket":   s.bucket,
		"region":   s.region,
		"useSSL":   s.useSSL,
	}
}

// New builds a Store and ensures the bucket exists (idempotent).
func New(cfg Config) (*Store, error) {
	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
		Region: cfg.Region,
	})
	if err != nil {
		return nil, fmt.Errorf("s3store: new client: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	exists, err := client.BucketExists(ctx, cfg.Bucket)
	if err != nil {
		return nil, fmt.Errorf("s3store: bucket check: %w", err)
	}
	if !exists {
		if err := client.MakeBucket(ctx, cfg.Bucket, minio.MakeBucketOptions{Region: cfg.Region}); err != nil {
			return nil, fmt.Errorf("s3store: make bucket: %w", err)
		}
	}

	return &Store{
		client:   client,
		bucket:   cfg.Bucket,
		endpoint: cfg.Endpoint,
		region:   cfg.Region,
		useSSL:   cfg.UseSSL,
	}, nil
}

// Upload stores an object under key. Pass size = -1 when unknown (streamed).
func (s *Store) Upload(ctx context.Context, key string, r io.Reader, size int64, contentType string) error {
	if _, err := s.client.PutObject(ctx, s.bucket, key, r, size, minio.PutObjectOptions{ContentType: contentType}); err != nil {
		return fmt.Errorf("s3store: upload %q: %w", key, err)
	}
	return nil
}

// Download returns a reader for the object at key. The caller must Close it.
func (s *Store) Download(ctx context.Context, key string) (io.ReadCloser, error) {
	obj, err := s.client.GetObject(ctx, s.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("s3store: download %q: %w", key, err)
	}
	return obj, nil
}

// PresignedGetURL devolve uma URL temporária e assinada para leitura direta
// do objeto (ex.: <img src=...>) — usada pelo módulo Activities (ADR 0029)
// pra servir fotos de checklist sem expor credenciais nem exigir header
// Authorization, que um <img> não envia.
func (s *Store) PresignedGetURL(ctx context.Context, key string, ttl time.Duration) (string, error) {
	u, err := s.client.PresignedGetObject(ctx, s.bucket, key, ttl, nil)
	if err != nil {
		return "", fmt.Errorf("s3store: presign %q: %w", key, err)
	}
	return u.String(), nil
}

// Bucket returns the configured bucket name.
func (s *Store) Bucket() string { return s.bucket }
