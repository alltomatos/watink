package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/alltomatos/watinkdev/engine-go/internal/command"
	"github.com/alltomatos/watinkdev/engine-go/internal/health"
	"github.com/alltomatos/watinkdev/engine-go/internal/rabbitmq"
	"github.com/alltomatos/watinkdev/engine-go/internal/whatsapp"
	"github.com/joho/godotenv"
	amqp "github.com/streadway/amqp"
)

type commandEnvelope struct {
	Type      string          `json:"type"`
	Timestamp int64           `json:"timestamp"`
	Payload   json.RawMessage `json:"payload"`
}

func main() {
	_ = godotenv.Load()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Health server — responde /health antes mesmo do RabbitMQ conectar
	go health.Start(ctx)

	rabbit := rabbitmq.NewRabbitMQService()
	if err := rabbit.Connect(); err != nil {
		log.Fatalf("Failed to connect to RabbitMQ: %v", err)
	}
	log.Println("Connected to RabbitMQ")

	sessionLoader := whatsapp.NewPostgresSessionLoader(whatsapp.BuildPostgresDSN())
	waService := whatsapp.NewWhatsAppService(rabbit, sessionLoader)

	go func() {
		time.Sleep(5 * time.Second)
		log.Println("Auto-restarting existing sessions...")
		waService.AutoRestartSessions()
	}()

	routingKeys := []string{
		"wbot.*.*.session.start",
		"wbot.*.*.session.stop",
		"wbot.*.*.session.delete",
		"wbot.*.*.message.send.text",
		"wbot.*.*.message.send.media",
		"wbot.*.*.message.send.buttons",
		"wbot.*.*.message.send.list",
		"wbot.*.*.message.send.poll",
		"wbot.*.*.message.send.interactive",
		"wbot.*.*.message.send.template",
		"wbot.*.*.message.send.carousel",
		"wbot.*.*.message.react",
		"wbot.*.*.message.markAsRead",
		"wbot.*.*.media.download",
		"wbot.*.*.contact.sync",
		"wbot.*.*.contact.import",
		"wbot.*.*.history.sync",
		"wbot.*.*.history.recover",
	}

	err := rabbit.ConsumeCommands("engine.go.commands", routingKeys, func(d amqp.Delivery) {
		if err := handleCommand(d, waService); err != nil {
			log.Printf("Command failed %s: %v", d.RoutingKey, err)
		}
		d.Ack(false)
	})
	if err != nil {
		log.Fatalf("Failed to start command consumer: %v", err)
	}

	log.Println("Watink Engine Go (whatsmeow) started — PostgreSQL store, RabbitMQ connected")

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	<-sig

	log.Println("Shutting down gracefully...")
	cancel() // para health server
	_ = rabbit.Close()
	log.Println("Engine stopped")
}

func handleCommand(d amqp.Delivery, svc *whatsapp.WhatsAppService) error {
	log.Printf("Received command: %s", d.RoutingKey)

	tenantID, sessionIDStr, cmd, err := command.ParseRoutingKey(d.RoutingKey)
	if err != nil {
		log.Printf("%v", err)
		return nil
	}

	sessionID, err := strconv.Atoi(sessionIDStr)
	if err != nil {
		log.Printf("Invalid session ID in routing key %s: %v", d.RoutingKey, err)
		return nil
	}

	var env commandEnvelope
	if err := json.Unmarshal(d.Body, &env); err != nil {
		return fmt.Errorf("unmarshal envelope: %w", err)
	}

	switch cmd {
	case "session.start":
		var p struct {
			ProxyURL       string `json:"proxyUrl"`
			UsePairingCode bool   `json:"usePairingCode"`
			PhoneNumber    string `json:"phoneNumber"`
			Name           string `json:"name"`
			Wid            string `json:"wid"`
		}
		if err := json.Unmarshal(env.Payload, &p); err != nil {
			return err
		}
		ts := env.Timestamp
		if ts == 0 {
			ts = time.Now().UnixMilli()
		}
		return svc.StartClient(sessionID, tenantID, p.Name, ts, p.ProxyURL, p.UsePairingCode, p.PhoneNumber, p.Wid)

	case "session.stop":
		return svc.StopClient(sessionID)

	case "session.delete":
		if err := svc.StopClient(sessionID); err != nil {
			log.Printf("Stop client warning for %d: %v", sessionID, err)
		}
		return svc.ForceLogout(sessionID)

	case "message.send.text":
		var p whatsapp.TextCommandPayload
		if err := json.Unmarshal(env.Payload, &p); err != nil {
			return err
		}
		return svc.SendText(sessionID, tenantID, p)

	case "message.send.media":
		var p whatsapp.MediaCommandPayload
		if err := json.Unmarshal(env.Payload, &p); err != nil {
			return err
		}
		return svc.SendMedia(sessionID, tenantID, p)

	case "message.send.buttons":
		var p whatsapp.ButtonsCommandPayload
		if err := json.Unmarshal(env.Payload, &p); err != nil {
			return err
		}
		return svc.SendButtons(sessionID, tenantID, p)

	case "message.send.list":
		var p whatsapp.ListCommandPayload
		if err := json.Unmarshal(env.Payload, &p); err != nil {
			return err
		}
		return svc.SendList(sessionID, tenantID, p)

	case "message.send.poll":
		var p whatsapp.PollCommandPayload
		if err := json.Unmarshal(env.Payload, &p); err != nil {
			return err
		}
		return svc.SendPoll(sessionID, tenantID, p)

	case "message.send.interactive":
		var p whatsapp.InteractiveCommandPayload
		if err := json.Unmarshal(env.Payload, &p); err != nil {
			return err
		}
		return svc.SendInteractive(sessionID, tenantID, p)

	case "message.send.template":
		var p whatsapp.TemplateCommandPayload
		if err := json.Unmarshal(env.Payload, &p); err != nil {
			return err
		}
		return svc.SendTemplate(sessionID, tenantID, p)

	case "message.send.carousel":
		var p whatsapp.CarouselCommandPayload
		if err := json.Unmarshal(env.Payload, &p); err != nil {
			return err
		}
		return svc.SendCarousel(sessionID, tenantID, p)

	case "message.react":
		var p whatsapp.ReactionCommandPayload
		if err := json.Unmarshal(env.Payload, &p); err != nil {
			return err
		}
		return svc.SendReaction(sessionID, tenantID, p)

	case "message.markAsRead":
		var p whatsapp.MarkReadCommandPayload
		if err := json.Unmarshal(env.Payload, &p); err != nil {
			return err
		}
		return svc.MarkRead(sessionID, tenantID, p)

	case "media.download":
		var p whatsapp.DownloadMediaCommandPayload
		if err := json.Unmarshal(env.Payload, &p); err != nil {
			return err
		}
		return svc.DownloadMedia(sessionID, tenantID, p)

	case "contact.sync":
		var p whatsapp.SyncContactPayload
		if err := json.Unmarshal(env.Payload, &p); err != nil {
			return err
		}
		return svc.SyncContact(sessionID, tenantID, p)

	case "contact.import":
		return svc.ImportContacts(sessionID, tenantID)

	case "history.recover":
		var p whatsapp.HistoryRecoverPayload
		if err := json.Unmarshal(env.Payload, &p); err != nil {
			return err
		}
		return svc.RecoverHistory(sessionID, tenantID, p)

	case "history.sync":
		log.Printf("Command %s received but not implemented in engine-go", cmd)
		return nil

	default:
		log.Printf("Unknown command type: %s", cmd)
		return nil
	}
}
