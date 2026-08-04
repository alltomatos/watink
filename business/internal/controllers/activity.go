package controllers

import (
	"github.com/alltomatos/watinkdev/business/internal/domain"
)

// ActivityController é o core CRUD de Activity (ADR 0029) — módulo de
// Ordens de Serviço. Recebe o ObjectStore desde a fundação (issue #527)
// porque a issue de evidência S3 (#531) precisa dele, e uma assinatura de
// construtor mudando depois de #529/#530 já implementados causaria churn em
// todos os call sites e testes. CRUD/rotas/handlers vêm nas issues
// seguintes — esta struct existe só para congelar a forma.
type ActivityController struct {
	s3Store domain.ObjectStore
}

func NewActivityController(s3Store domain.ObjectStore) *ActivityController {
	return &ActivityController{s3Store: s3Store}
}
