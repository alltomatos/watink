package plugins

// Request/response HTTP shapes — separate from domain.GroupInfo etc.
// (which describe the provider-facing contract) so the REST surface can
// evolve independently of the domain.GroupEngine interface.

type createGroupRequest struct {
	WhatsappID   int      `json:"whatsappId" binding:"required"`
	Subject      string   `json:"subject" binding:"required"`
	Participants []string `json:"participants"`
}

type updateGroupSettingsRequest struct {
	WhatsappID    int     `json:"whatsappId" binding:"required"`
	Subject       *string `json:"subject"`
	Description   *string `json:"description"`
	PictureURL    *string `json:"pictureURL"`
	Announce      *bool   `json:"announce"`
	Locked        *bool   `json:"locked"`
	MemberAddMode *string `json:"memberAddMode"`
}

type updateParticipantsRequest struct {
	WhatsappID   int      `json:"whatsappId" binding:"required"`
	Action       string   `json:"action" binding:"required,oneof=add remove promote demote"`
	Participants []string `json:"participants" binding:"required,min=1"`
}

type resolveJoinRequestsRequest struct {
	WhatsappID   int      `json:"whatsappId" binding:"required"`
	Action       string   `json:"action" binding:"required,oneof=approve reject"`
	Participants []string `json:"participants" binding:"required,min=1"`
}

type createCommunityRequest struct {
	WhatsappID int    `json:"whatsappId" binding:"required"`
	Name       string `json:"name" binding:"required"`
}

type linkCommunityGroupRequest struct {
	WhatsappID int `json:"whatsappId" binding:"required"`
}
