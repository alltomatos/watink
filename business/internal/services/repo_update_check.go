package services

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// RepoUpdateStatus reports whether the running build's commit is caught up
// with the latest commit on its branch in the public repo, for the
// Configurações → Sobre page.
type RepoUpdateStatus struct {
	Status        string `json:"status"` // "up_to_date" | "behind" | "unknown"
	CommitsBehind int    `json:"commitsBehind"`
}

// CheckRepoUpdateStatus compares the running commit against the current tip
// of its branch via the GitHub compare API (repos/alltomatos/watink).
// Best-effort: any failure — offline, rate-limited, dev build with
// commit/branch "unknown" (ldflags unset outside the Docker build) —
// degrades to {"unknown", 0} rather than failing the /about response.
func CheckRepoUpdateStatus(commit, branch string) RepoUpdateStatus {
	if commit == "" || commit == "unknown" || branch == "" || branch == "unknown" {
		return RepoUpdateStatus{Status: "unknown"}
	}

	client := &http.Client{Timeout: 5 * time.Second}
	url := fmt.Sprintf("https://api.github.com/repos/alltomatos/watink/compare/%s...%s", commit, branch)
	resp, err := client.Get(url)
	if err != nil {
		return RepoUpdateStatus{Status: "unknown"}
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode >= 400 {
		return RepoUpdateStatus{Status: "unknown"}
	}

	var out struct {
		Status  string `json:"status"`
		AheadBy int    `json:"ahead_by"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return RepoUpdateStatus{Status: "unknown"}
	}

	switch out.Status {
	case "identical", "behind":
		// "behind" aqui é relativo à comparação commit...branch: o branch está
		// atrás do commit rodando (commits locais não publicados, ex. build de
		// um merge ainda não pushado) — nada novo disponível pra puxar.
		return RepoUpdateStatus{Status: "up_to_date"}
	case "ahead", "diverged":
		return RepoUpdateStatus{Status: "behind", CommitsBehind: out.AheadBy}
	default:
		return RepoUpdateStatus{Status: "unknown"}
	}
}
