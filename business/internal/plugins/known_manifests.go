package plugins

// KnownProSlugs devolve o conjunto de slugs `pro` dos plugins embarcados,
// pelo manifesto local (GetManifest(), zero-value struct — nenhuma das
// implementações precisa de DI pra montar o manifesto). Usado pela
// reconciliação de downgrade (services.SetupService.PushSubscription,
// issue #622): decidir "este slug é pro" ali não pode depender de uma
// chamada de rede ao catálogo do Hub dentro de uma transação de DB, então
// usa este sinal local best-effort em vez do PluginRegistry.IsFreePlugin
// (que é a autoridade real de runtime, usada em Activate/GetStatus).
//
// Uma divergência aqui (Type trocado no Console do Hub depois do deploy
// deste binário) só atrasa a reconciliação automática de um downgrade — o
// gate de CRESCIMENTO em Activate continua fail-closed independentemente,
// então não é um buraco de segurança, só uma imprecisão de limpeza.
func KnownProSlugs() map[string]bool {
	manifests := []sdkManifestSlugType{
		{Slug: (&HelpdeskPlugin{}).GetManifest().Slug, Type: (&HelpdeskPlugin{}).GetManifest().Type},
		{Slug: (&WebchatPlugin{}).GetManifest().Slug, Type: (&WebchatPlugin{}).GetManifest().Type},
		{Slug: (&AssistantPlugin{}).GetManifest().Slug, Type: (&AssistantPlugin{}).GetManifest().Type},
		{Slug: (&GroupsPlugin{}).GetManifest().Slug, Type: (&GroupsPlugin{}).GetManifest().Type},
	}
	pro := make(map[string]bool, len(manifests))
	for _, m := range manifests {
		if m.Type == "pro" {
			pro[m.Slug] = true
		}
	}
	return pro
}

type sdkManifestSlugType struct {
	Slug string
	Type string
}
