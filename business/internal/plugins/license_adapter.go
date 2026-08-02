package plugins

import "github.com/alltomatos/watinkdev/business/internal/pluginlicense"

// pluginLicenseClientAdapter adapts *pluginlicense.Client to the
// LicenseFetcher interface this package depends on, translating
// pluginlicense.LicenseInfo into the local LicenseInfo shape. Kept as a thin
// adapter (not a reverse dependency) so plugins/registry.go never imports
// pluginlicense types directly — only the LicenseFetcher interface, per the
// project's "mocks in local structs, no global mock" testing convention.
type pluginLicenseClientAdapter struct {
	client *pluginlicense.Client
}

// NewLicenseFetcher wraps a *pluginlicense.Client so it satisfies
// LicenseFetcher. Used from main.go to inject the real client into
// NewPluginRegistry (DI pura via construtor).
func NewLicenseFetcher(client *pluginlicense.Client) LicenseFetcher {
	return &pluginLicenseClientAdapter{client: client}
}

func (a *pluginLicenseClientAdapter) GetLicense(pluginSlug string) (LicenseInfo, error) {
	info, err := a.client.GetLicense(pluginSlug)
	if err != nil {
		return LicenseInfo{}, err
	}
	return LicenseInfo{
		Status:    info.Status,
		TenantCap: info.TenantCap,
		Exp:       info.Exp,
	}, nil
}

// catalogClientAdapter adapts *pluginlicense.Client to CatalogFetcher, same
// "thin adapter, no reverse import" pattern as pluginLicenseClientAdapter
// above -- registry.go never imports pluginlicense types directly.
type catalogClientAdapter struct {
	client *pluginlicense.Client
}

// NewCatalogFetcher wraps a *pluginlicense.Client so it satisfies
// CatalogFetcher. Used from main.go/routes.go to inject the real client
// into NewPluginRegistry (DI pura via construtor) -- reuses the SAME
// *pluginlicense.Client instance already passed to NewLicenseFetcher, no
// new HTTP client/connection pool.
func NewCatalogFetcher(client *pluginlicense.Client) CatalogFetcher {
	return &catalogClientAdapter{client: client}
}

func (a *catalogClientAdapter) GetCatalog() ([]CatalogEntry, error) {
	resp, err := a.client.GetCatalog()
	if err != nil {
		return nil, err
	}
	entries := make([]CatalogEntry, 0, len(resp.Plugins))
	for _, p := range resp.Plugins {
		entries = append(entries, CatalogEntry{Slug: p.Slug, Type: p.Type})
	}
	return entries, nil
}
