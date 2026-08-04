package enginego

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"

	"github.com/alltomatos/watinkdev/business/pkg/utils"
)

// groupsHTTPClient is a small, timeout-bounded HTTP client for the
// engine-go internal groups API (engine-go/docs/groups-api.md). Resolved
// lazily from env (GROUPS_API_URL, GROUPS_API_TOKEN) on each call — same
// pattern as izapia.Provider.clientFor resolving per-tenant credentials —
// rather than threaded through enginego.New's constructor, to avoid
// widening that signature for every existing call site
// (internal/services/whatsapp_session.go and its tests).
var groupsHTTPClient = &http.Client{Timeout: 8 * time.Second}

// groupsAPIConfig returns the internal API's base URL and token, or a
// friendly, actionable error if either is unset — fail-closed, matching
// the engine-go side's own refusal to start without GROUPS_API_TOKEN.
func groupsAPIConfig() (baseURL, token string, err error) {
	baseURL = os.Getenv("GROUPS_API_URL")
	token = os.Getenv("GROUPS_API_TOKEN")
	if baseURL == "" || token == "" {
		return "", "", utils.NewFriendlyError(http.StatusServiceUnavailable,
			"Gestão de grupos indisponível para esta conexão no momento.",
			errors.New("enginego: GROUPS_API_URL/GROUPS_API_TOKEN não configurados"))
	}
	return baseURL, token, nil
}

// groupsEnvelope mirrors engine-go's response envelope exactly
// (engine-go/docs/groups-api.md "Envelope") — enginego.Provider and
// izapia.Provider are meant to stay code-mirrors of each other.
type groupsEnvelope struct {
	OK    bool               `json:"ok"`
	Data  json.RawMessage    `json:"data"`
	Error *groupsErrorDetail `json:"error"`
}

type groupsErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *groupsErrorDetail) Error() string {
	if e == nil {
		return "enginego groupsapi: erro desconhecido"
	}
	return fmt.Sprintf("enginego groupsapi: %s: %s", e.Code, e.Message)
}

// groupsDo issues one request against the internal groups API. NO retry —
// a retried write (e.g. add participant) would duplicate the action; the
// caller decides whether to retry a read.
func groupsDo(ctx context.Context, method, path string, body, out interface{}) error {
	baseURL, token, err := groupsAPIConfig()
	if err != nil {
		return err
	}

	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("enginego groupsapi: encode request: %w", err)
		}
		reqBody = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, baseURL+path, reqBody)
	if err != nil {
		return fmt.Errorf("enginego groupsapi: build request: %w", err)
	}
	req.Header.Set("X-Internal-Token", token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := groupsHTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("enginego groupsapi: request %s %s: %w", method, path, err)
	}
	defer func() { _ = resp.Body.Close() }()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("enginego groupsapi: read response %s %s: %w", method, path, err)
	}

	var env groupsEnvelope
	if err := json.Unmarshal(respBody, &env); err != nil {
		return fmt.Errorf("enginego groupsapi: decode response %s %s (status %d): %w", method, path, resp.StatusCode, err)
	}
	if !env.OK {
		if env.Error != nil {
			return env.Error
		}
		return fmt.Errorf("enginego groupsapi: %s %s falhou (status %d)", method, path, resp.StatusCode)
	}
	if out != nil && len(env.Data) > 0 {
		if err := json.Unmarshal(env.Data, out); err != nil {
			return fmt.Errorf("enginego groupsapi: decode data %s %s: %w", method, path, err)
		}
	}
	return nil
}

func sessionGroupsPath(sessionID int) string {
	return "/sessions/" + strconv.Itoa(sessionID) + "/groups"
}

func sessionGroupItemPath(sessionID int, groupJID string) string {
	return sessionGroupsPath(sessionID) + "/" + url.PathEscape(groupJID)
}

func sessionCommunitiesPath(sessionID int) string {
	return "/sessions/" + strconv.Itoa(sessionID) + "/communities"
}

func sessionCommunityItemPath(sessionID int, communityJID string) string {
	return sessionCommunitiesPath(sessionID) + "/" + url.PathEscape(communityJID)
}
