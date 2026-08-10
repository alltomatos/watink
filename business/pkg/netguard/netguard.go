// Package netguard implementa uma checagem de SSRF reutilizável: resolve o
// host antes de conectar e recusa endereços privados/loopback/link-local
// (inclui o endpoint de metadados de nuvem 169.254.169.254). Mesmo padrão já
// usado por internal/knowledge/fetch_url.go — extraído aqui para não
// duplicar a lógica onde outro cliente HTTP também recebe host de fora
// (ex.: saasclient, quando a baseURL vem de um admin em vez de constante).
package netguard

import (
	"context"
	"fmt"
	"net"
	"time"
)

// SafeDialContext é um net.Dialer.DialContext que só conecta a IPs públicos.
// Use como Transport.DialContext de um *http.Client cuja URL de destino não é
// inteiramente controlada pelo código (input de usuário/admin).
func SafeDialContext(ctx context.Context, network, addr string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}

	ips, err := net.DefaultResolver.LookupIP(ctx, "ip", host)
	if err != nil {
		return nil, fmt.Errorf("ERR_SSRF_DNS: %w", err)
	}
	for _, ip := range ips {
		if !IsPublicIP(ip) {
			return nil, fmt.Errorf("ERR_SSRF_BLOCKED: refusing to connect to non-public address %s", ip)
		}
	}

	dialer := &net.Dialer{Timeout: 10 * time.Second}
	return dialer.DialContext(ctx, network, net.JoinHostPort(ips[0].String(), port))
}

// IsPublicIP rejeita loopback, privado (RFC1918), link-local (inclui
// 169.254.169.254, o endpoint de metadados de nuvem), unspecified e
// multicast.
func IsPublicIP(ip net.IP) bool {
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsUnspecified() || ip.IsMulticast() {
		return false
	}
	return true
}
