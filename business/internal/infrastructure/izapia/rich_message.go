package izapia

import (
	"context"
	"fmt"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
)

var _ domain.RichMessageEngine = (*Provider)(nil)

// SendInteractive dispatches a domain.RichMessageRequest (interactive/poll/
// carousel — built by flow.BuildRichMessageRequest from a QuickAnswer) to the
// matching izapia endpoint.
func (p *Provider) SendInteractive(ctx context.Context, w models.Whatsapp, to, messageID string, req domain.RichMessageRequest) error {
	if w.IzapiaSessionID == nil || *w.IzapiaSessionID == "" {
		return fmt.Errorf("izapia: conexão %d sem sessão izapia ativa", w.ID)
	}
	client, err := p.clientFor(w)
	if err != nil {
		return err
	}
	sid := *w.IzapiaSessionID

	switch req.Kind {
	case "interactive":
		buttons := make([]InteractiveButtonReq, 0, len(req.Buttons))
		for _, b := range req.Buttons {
			buttons = append(buttons, toInteractiveButtonReq(b))
		}
		_, err = client.SendInteractive(ctx, sid, to, req.Body, buttons)
		return err

	case "poll":
		_, err = client.SendPoll(ctx, sid, to, req.PollQuestion, req.PollOptions, req.PollSelectableCount)
		return err

	case "carousel":
		cards := make([]CarouselCardReq, 0, len(req.Cards))
		for _, c := range req.Cards {
			buttons := make([]InteractiveButtonReq, 0, len(c.Buttons))
			for _, b := range c.Buttons {
				buttons = append(buttons, toInteractiveButtonReq(b))
			}
			imgURL, err := p.absoluteMediaURL(w, c.ImageURL)
			if err != nil {
				return err
			}
			cards = append(cards, CarouselCardReq{ImageURL: imgURL, Mimetype: c.Mimetype, Title: c.Title, Buttons: buttons})
		}
		_, _, err = client.SendCarousel(ctx, sid, to, req.Body, cards)
		return err

	default:
		return fmt.Errorf("izapia: RichMessageRequest.Kind %q não suportado", req.Kind)
	}
}

func toInteractiveButtonReq(b domain.InteractiveButton) InteractiveButtonReq {
	req := InteractiveButtonReq{ID: b.ID, Kind: b.Kind, Label: b.Label, Value: b.Value}
	if b.Kind == "list" {
		sections := make([]InteractiveListSection, 0, len(b.List))
		for _, s := range b.List {
			rows := make([]InteractiveListRow, 0, len(s.Rows))
			for _, r := range s.Rows {
				rows = append(rows, InteractiveListRow{ID: r.ID, Title: r.Title, Description: r.Description})
			}
			sections = append(sections, InteractiveListSection{Title: s.Title, Rows: rows})
		}
		req.List = sections
	}
	return req
}
