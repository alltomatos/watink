package controllers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// @Summary      Criar usuário
// @Tags         users
// @Accept       json
// @Produce      json
// @Param        body  body      map[string]interface{}  true  "Dados do usuário"
// @Success      200   {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /users [post]
type setorVinculo struct {
	SetorID  int  `json:"setorId"`
	EhGestor bool `json:"ehGestor"`
}

type createUserRequest struct {
	Name       string         `json:"name" binding:"required"`
	Email      string         `json:"email" binding:"required,email"`
	Password   string         `json:"password" binding:"required"`
	Alcance    string         `json:"alcance"`
	WhatsappID *int           `json:"whatsappId"`
	CargoID    *int           `json:"cargoId"`
	Configs    string         `json:"configs"`
	Setores    []setorVinculo `json:"setores"`
}

// alcanceRank ordena os alcances do ADR 0022 (proprio < setor < tenant <
// plataforma). Serve para (a) validar o enum e (b) impedir escalonamento de
// privilégio: um ator nunca concede a outro (nem a si) um alcance acima do
// próprio. Sem isso, qualquer portador de users:update se auto-promoveria a
// plataforma → bypass total do RBAC + rotas SaaS cross-tenant (P1-1).
var alcanceRank = map[string]int{
	"proprio":    0,
	"setor":      1,
	"tenant":     2,
	"plataforma": 3,
}

func isValidAlcance(a string) bool {
	_, ok := alcanceRank[a]
	return ok
}

// minPasswordLen é o piso de comprimento de senha (P2-5). Sem isso o wizard
// aceitava criar o Administrador com senha "a".
const minPasswordLen = 8

// validatePasswordStrength rejeita senhas curtas demais (após trim). Aplicado
// em todo caminho que DEFINE uma senha (setup, criar/atualizar usuário, /me).
func validatePasswordStrength(pwd string) error {
	if len(strings.TrimSpace(pwd)) < minPasswordLen {
		return fmt.Errorf("field 'password' must be at least %d characters", minPasswordLen)
	}
	return nil
}

// normalizeEmail deixa o email canônico (lowercase + trim) — evita o cadastro
// "Admin@x.com" no wizard e login "admin@x.com" batendo em 401 (P2-6). O
// read-path de login (FindByEmailForAuth) casa por LOWER(email) para cobrir
// também dados já gravados com caixa mista.
func normalizeEmail(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// actorAlcance lê o alcance do usuário autenticado (token) do contexto Gin.
func actorAlcance(c *gin.Context) string {
	v, _ := c.Get("alcance")
	s, _ := v.(string)
	return s
}

// cargoBelongsToTenant confirma que o Cargo pertence ao tenant do ator.
// Cargos é tenant-scoped mas Permissions é catálogo global — apontar cargoId
// para um Cargo de outro tenant faria RequirePermission/Can avaliarem
// permissões estrangeiras (P2-1). Session(NewDB) obrigatório: o db de
// GetScoped acumula condições e casaria 0 linhas se reusado.
func cargoBelongsToTenant(db *gorm.DB, cargoID int, tenantID uuid.UUID) (bool, error) {
	var count int64
	err := db.Session(&gorm.Session{NewDB: true}).
		Model(&models.Cargo{}).
		Where(`id = ? AND "tenantId" = ?`, cargoID, tenantID).
		Count(&count).Error
	return count > 0, err
}

// replaceUserSetores aplica o conjunto de vínculos de Setor de um usuário
// (replace, não merge): apaga os vínculos antigos e insere os novos dentro de
// uma transação. Valida que todos os setorId pertencem ao tenant ANTES de
// aplicar qualquer mudança (all-or-nothing).
func replaceUserSetores(db *gorm.DB, userID int, tenantID uuid.UUID, vinculos []setorVinculo) error {
	if vinculos == nil {
		return nil
	}
	setorIDs := make([]int, len(vinculos))
	for i, v := range vinculos {
		setorIDs[i] = v.SetorID
	}
	if len(setorIDs) > 0 {
		var count int64
		db.Session(&gorm.Session{NewDB: true}).Model(&models.Setor{}).
			Where(`id IN ? AND "tenantId" = ?`, setorIDs, tenantID).
			Count(&count)
		if int(count) != len(uniqueInts(setorIDs)) {
			return fmt.Errorf("um ou mais setorId não pertencem a este tenant")
		}
	}
	return db.Session(&gorm.Session{NewDB: true}).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where(`"userId" = ?`, userID).Delete(&models.UserSetor{}).Error; err != nil {
			return err
		}
		for _, v := range vinculos {
			if err := tx.Create(&models.UserSetor{UserID: userID, SetorID: v.SetorID, EhGestor: v.EhGestor}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (uc *UserController) CreateUser(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Users")
	if !ok {
		return
	}

	if err := uc.planLimitSvc.CheckLimit(tenantID, "users"); err != nil {
		respondPlanLimitError(c, err, "User limit reached for this plan")
		return
	}

	var req createUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	if _, err := utils.ValidateStringField(req.Name, "name", 255); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := utils.ValidateStringField(req.Password, "password", 128); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validatePasswordStrength(req.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := utils.ValidateStringField(req.Alcance, "alcance", 50); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := utils.ValidateStringField(req.Configs, "configs", 65535); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tmp := models.User{}
	if err := tmp.HashPassword(req.Password); err != nil {
		utils.RespondWithInternalError(c, err, "HashPassword")
		return
	}

	alcance := req.Alcance
	if alcance == "" {
		alcance = "proprio"
	}
	if !isValidAlcance(alcance) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "field 'alcance' inválido"})
		return
	}
	if alcanceRank[alcance] > alcanceRank[actorAlcance(c)] {
		c.JSON(http.StatusForbidden, gin.H{"error": "não é possível conceder alcance superior ao seu"})
		return
	}

	if req.CargoID != nil {
		inTenant, err := cargoBelongsToTenant(db, *req.CargoID, tenantID)
		if err != nil {
			utils.RespondWithInternalError(c, err, "CreateUser")
			return
		}
		if !inTenant {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cargoId não pertence a este tenant"})
			return
		}
	}

	configs := req.Configs
	if configs == "" {
		configs = "{}"
	}

	domainUser := &domain.User{
		Name:         req.Name,
		Email:        normalizeEmail(req.Email),
		PasswordHash: tmp.PasswordHash,
		TenantID:     tenantID,
		Alcance:      alcance,
		WhatsappID:   req.WhatsappID,
		CargoID:      req.CargoID,
		Configs:      configs,
	}

	if err := uc.userRepo.Create(c.Request.Context(), domainUser); err != nil {
		utils.RespondWithInternalError(c, err, "CreateUser")
		return
	}

	if err := replaceUserSetores(db, domainUser.ID, tenantID, req.Setores); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, domainUser)
}

// @Summary      Atualizar usuário
// @Tags         users
// @Accept       json
// @Produce      json
// @Param        userId  path      int                     true  "ID do usuário"
// @Param        body    body      map[string]interface{}  true  "Campos a atualizar"
// @Success      200     {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /users/{userId} [put]
func (uc *UserController) UpdateUser(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Users")
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("userId"))

	user, err := uc.userRepo.FindByID(c.Request.Context(), id, tenantID)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found or access denied"})
		return
	}

	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	updateMap := make(map[string]interface{})

	// Password: hash before persisting
	if pwd, ok := req["password"].(string); ok && pwd != "" {
		if _, err := utils.ValidateStringField(pwd, "password", 128); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if err := validatePasswordStrength(pwd); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		tmp := models.User{PasswordHash: user.PasswordHash}
		if err := tmp.HashPassword(pwd); err != nil {
			utils.RespondWithInternalError(c, err, "HashPassword")
			return
		}
		updateMap["passwordHash"] = tmp.PasswordHash
	}

	// Scalar fields
	if v, ok := req["name"].(string); ok {
		name, err := utils.ValidateStringField(v, "name", 255)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		updateMap["name"] = name
	}
	if v, ok := req["email"].(string); ok {
		email, err := utils.ValidateStringField(v, "email", 255)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if !strings.Contains(email, "@") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "field 'email' must be a valid email address"})
			return
		}
		updateMap["email"] = normalizeEmail(email)
	}
	if v, ok := req["alcance"].(string); ok {
		alcance, err := utils.ValidateStringField(v, "alcance", 50)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if !isValidAlcance(alcance) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "field 'alcance' inválido"})
			return
		}
		// No-escalation: o ator nunca eleva o alcance de alguém (nem o próprio)
		// acima do seu. Fecha a auto-promoção a plataforma via users:update (P1-1).
		if alcanceRank[alcance] > alcanceRank[actorAlcance(c)] {
			c.JSON(http.StatusForbidden, gin.H{"error": "não é possível conceder alcance superior ao seu"})
			return
		}
		updateMap["alcance"] = alcance
	}
	if v, ok := req["whatsappId"]; ok {
		if v == "" || v == nil {
			updateMap["whatsappId"] = nil
		} else {
			s := formatInt(v)
			updateMap["whatsappId"] = s
		}
	}
	if v, ok := req["cargoId"]; ok {
		var newCargoID *int
		if v != "" && v != nil {
			n, okRange := safeInt(formatInt(v))
			if !okRange {
				c.JSON(http.StatusBadRequest, gin.H{"error": "field 'cargoId' is out of range"})
				return
			}
			newCargoID = &n
		}

		// Tenant-guard: o Cargo tem de pertencer a este tenant — impede herdar
		// permissões de um Cargo estrangeiro apontando cargoId cross-tenant (P2-1).
		if newCargoID != nil {
			inTenant, err := cargoBelongsToTenant(db, *newCargoID, tenantID)
			if err != nil {
				utils.RespondWithInternalError(c, err, "UpdateUser")
				return
			}
			if !inTenant {
				c.JSON(http.StatusBadRequest, gin.H{"error": "cargoId não pertence a este tenant"})
				return
			}
		}

		// Anti-lockout (ADR 0022): o dono do tenant e o último Administrador só
		// podem trocar para outro Cargo "Administrador" — nunca para um cargo
		// diferente, o que os rebaixaria e travaria a organização.
		if isTenantOwner(db, id, tenantID) || isLastAdminOfTenant(db, id, tenantID) {
			if !isCargoAdministrador(db, newCargoID, tenantID) {
				c.JSON(http.StatusConflict, gin.H{"error": "não é possível trocar o cargo do dono/último Administrador do tenant para um cargo que não seja Administrador"})
				return
			}
		}

		if newCargoID == nil {
			updateMap["cargoId"] = nil
		} else {
			updateMap["cargoId"] = *newCargoID
		}
	}

	if v, ok := req["setores"]; ok {
		raw, isSlice := v.([]interface{})
		if !isSlice {
			c.JSON(http.StatusBadRequest, gin.H{"error": "field 'setores' must be an array"})
			return
		}
		vinculos := make([]setorVinculo, 0, len(raw))
		for _, item := range raw {
			m, isMap := item.(map[string]interface{})
			if !isMap {
				c.JSON(http.StatusBadRequest, gin.H{"error": "each item in 'setores' must be an object {setorId, ehGestor}"})
				return
			}
			setorID, okRange := safeInt(formatInt(m["setorId"]))
			if !okRange {
				c.JSON(http.StatusBadRequest, gin.H{"error": "field 'setorId' is out of range"})
				return
			}
			vinculo := setorVinculo{SetorID: setorID}
			if eg, ok := m["ehGestor"].(bool); ok {
				vinculo.EhGestor = eg
			}
			vinculos = append(vinculos, vinculo)
		}
		if err := replaceUserSetores(db, id, tenantID, vinculos); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	if err := uc.userRepo.Update(c.Request.Context(), user, updateMap); err != nil {
		utils.RespondWithInternalError(c, err, "UpdateUser")
		return
	}

	c.JSON(http.StatusOK, user)
}
