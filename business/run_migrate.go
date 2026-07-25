package main

import (
	"github.com/alltomatos/watinkdev/business/internal/database"
	"github.com/joho/godotenv"
	"log"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Error loading .env file")
	}

	database.Connect()
	database.Migrate()
	log.Println("Migration and Seed finished successfully")
}
