package controllers

import (
	"strings"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// @Summary      Criar pipeline
// @Tags         pipelines
// @Accept       json
// @Produce      json
// @Param        body  body      map[string]interface{}  true  "Dados do pipeline"
// @Success      200   {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /pipelines [post]
func (pc *PipelineController) Create(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Pipelines")
	if !ok {
		return
	}

	var input createPipelineInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	pipelineName, err := utils.ValidateStringField(input.Name, "name", 255)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	for i, st := range input.Stages {
		if _, err := utils.ValidateStringField(st.Name, "stage.name", 100); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}
		_ = i
	}

	pipelineType := "kanban"
	if input.Type == "funnel" {
		pipelineType = "funnel"
	}

	pipeline := models.Pipeline{
		Name:        pipelineName,
		Description: input.Description,
		Type:        pipelineType,
		TenantID:    tenantID,
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&pipeline).Error; err != nil {
			return err
		}
		for i, st := range input.Stages {
			if strings.TrimSpace(st.Name) == "" {
				continue
			}
			if err := tx.Create(&models.PipelineStage{Name: st.Name, PipelineID: pipeline.ID, Order: i}).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		utils.RespondWithInternalError(c, err, "CreatePipeline")
		return
	}

	db.Where("id = ?", pipeline.ID).Preload("Stages").First(&pipeline)
	c.JSON(200, pipeline)
}

// @Summary      Excluir pipeline
// @Tags         pipelines
// @Produce      json
// @Param        pipelineId  path      int  true  "ID do pipeline"
// @Success      200         {object}  map[string]string
// @Failure      404         {object}  map[string]string
// @Security     BearerAuth
// @Router       /pipelines/{pipelineId} [delete]
func (pc *PipelineController) Delete(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Pipelines")
	if !ok {
		return
	}
	id := c.Param("pipelineId")

	var pipeline models.Pipeline
	if err := db.Where("id = ? AND \"tenantId\" = ?", id, tenantID).Preload("Stages").First(&pipeline).Error; err != nil {
		c.JSON(404, gin.H{"error": "Pipeline not found"})
		return
	}

	stageIDs := make([]int, len(pipeline.Stages))
	for i, s := range pipeline.Stages {
		stageIDs[i] = s.ID
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		// Não há outro pipeline para o qual migrar os Deals destas etapas — o
		// container inteiro está sendo removido, então os Deals vinculados são
		// removidos junto (nunca deixados com stageId apontando para uma etapa
		// inexistente).
		if len(stageIDs) > 0 {
			if err := tx.Session(&gorm.Session{NewDB: true}).
				Where("\"stageId\" IN ?", stageIDs).
				Delete(&models.Deal{}).Error; err != nil {
				return err
			}
			if err := tx.Session(&gorm.Session{NewDB: true}).
				Where("\"pipelineId\" = ?", pipeline.ID).
				Delete(&models.PipelineStage{}).Error; err != nil {
				return err
			}
		}
		return tx.Session(&gorm.Session{NewDB: true}).
			Where("id = ? AND \"tenantId\" = ?", pipeline.ID, tenantID).
			Delete(&models.Pipeline{}).Error
	})
	if err != nil {
		utils.RespondWithInternalError(c, err, "DeletePipeline")
		return
	}

	c.JSON(200, gin.H{"message": "Pipeline deleted successfully"})
}

// @Summary      Atualizar pipeline
// @Tags         pipelines
// @Accept       json
// @Produce      json
// @Param        pipelineId  path      int                     true  "ID do pipeline"
// @Param        body        body      map[string]interface{}  true  "Campos a atualizar"
// @Success      200         {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /pipelines/{pipelineId} [put]
func (pc *PipelineController) Update(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Pipelines")
	if !ok {
		return
	}
	id := c.Param("pipelineId")

	var pipeline models.Pipeline
	if err := db.Where("id = ? AND \"tenantId\" = ?", id, tenantID).Preload("Stages").First(&pipeline).Error; err != nil {
		c.JSON(404, gin.H{"error": "Pipeline not found"})
		return
	}

	var input updatePipelineInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	if strings.TrimSpace(input.Name) != "" {
		updName, err := utils.ValidateStringField(input.Name, "name", 255)
		if err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}
		pipeline.Name = updName
	}
	if input.Description != "" {
		pipeline.Description = input.Description
	}
	if input.Type == "kanban" || input.Type == "funnel" {
		pipeline.Type = input.Type
	}

	// Validate: at least one non-empty stage if stages are provided
	if input.Stages != nil {
		nonEmpty := 0
		for _, st := range input.Stages {
			if strings.TrimSpace(st.Name) != "" {
				nonEmpty++
			}
		}
		if nonEmpty == 0 {
			c.JSON(422, gin.H{"error": "Pipeline must have at least one stage"})
			return
		}
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Session(&gorm.Session{NewDB: true}).Save(&pipeline).Error; err != nil {
			return err
		}

		if input.Stages != nil {
			// Build name→stage map for existing stages
			existing := make(map[string]models.PipelineStage, len(pipeline.Stages))
			for _, s := range pipeline.Stages {
				existing[s.Name] = s
			}

			// Build set of incoming names
			incoming := make(map[string]bool)
			for _, st := range input.Stages {
				if strings.TrimSpace(st.Name) != "" {
					incoming[st.Name] = true
				}
			}

			// Upsert surviving + create new stages FIRST, so every incoming
			// stage already has a persisted ID before we migrate deals or
			// delete anything. firstIncomingID is stages[0] — the migration
			// target for deals on removed stages (ADR 0009).
			var firstIncomingID int
			for i, st := range input.Stages {
				if strings.TrimSpace(st.Name) == "" {
					continue
				}
				var stageID int
				freshTxStage := tx.Session(&gorm.Session{NewDB: true})
				if prev, ok := existing[st.Name]; ok {
					// Same name — update order only
					prev.Order = i
					if err := freshTxStage.Save(&prev).Error; err != nil {
						return err
					}
					stageID = prev.ID
				} else {
					// New stage
					newStage := models.PipelineStage{Name: st.Name, PipelineID: pipeline.ID, Order: i}
					if err := freshTxStage.Create(&newStage).Error; err != nil {
						return err
					}
					stageID = newStage.ID
				}
				if firstIncomingID == 0 {
					firstIncomingID = stageID
				}
			}

			// Migrate deals off every removed stage to stages[0] BEFORE deleting
			// it — never orphan a Deal (ADR 0009). This now also covers the case
			// where ALL stages are renamed/replaced (no surviving same-name
			// stage), which previously deleted stages and orphaned their Deals.
			for name, stage := range existing {
				if incoming[name] {
					continue
				}
				freshTx := tx.Session(&gorm.Session{NewDB: true})
				if firstIncomingID != 0 {
					if err := freshTx.Model(&models.Deal{}).
						Where("\"stageId\" = ?", stage.ID).
						Update("stageId", firstIncomingID).Error; err != nil {
						return err
					}
				}
				if err := freshTx.Delete(&models.PipelineStage{}, stage.ID).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})

	if err != nil {
		utils.RespondWithInternalError(c, err, "UpdatePipeline")
		return
	}

	db.Where("id = ?", pipeline.ID).Preload("Stages").First(&pipeline)
	c.JSON(200, pipeline)
}
