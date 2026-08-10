package netguard

import (
	"net"
	"testing"
)

func TestIsPublicIP(t *testing.T) {
	cases := []struct {
		name string
		ip   string
		want bool
	}{
		{"loopback v4", "127.0.0.1", false},
		{"loopback v6", "::1", false},
		{"private RFC1918 10.x", "10.0.0.5", false},
		{"private RFC1918 192.168.x", "192.168.0.1", false},
		{"private RFC1918 172.16.x", "172.16.0.1", false},
		{"link-local / cloud metadata", "169.254.169.254", false},
		{"unspecified", "0.0.0.0", false},
		{"multicast", "224.0.0.1", false},
		{"public", "8.8.8.8", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ip := net.ParseIP(tc.ip)
			if ip == nil {
				t.Fatalf("net.ParseIP(%q) returned nil", tc.ip)
			}
			if got := IsPublicIP(ip); got != tc.want {
				t.Errorf("IsPublicIP(%s) = %v, want %v", tc.ip, got, tc.want)
			}
		})
	}
}

func TestSafeDialContext_RecusaLoopback(t *testing.T) {
	_, err := SafeDialContext(t.Context(), "tcp", "127.0.0.1:80")
	if err == nil {
		t.Fatal("esperava erro ao conectar em endereço loopback, obteve nil")
	}
}
