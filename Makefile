.PHONY: help prod-up prod-down prod-restart prod-logs prod-status backup clean

help:
	@echo "Stream Share Hub - Production Commands"
	@echo ""
	@echo "Usage:"
	@echo "  make prod-up       - Start all production services"
	@echo "  make prod-down     - Stop all production services"
	@echo "  make prod-restart  - Restart all production services"
	@echo "  make prod-logs     - View logs (follow mode)"
	@echo "  make prod-status   - Show service status"
	@echo "  make backup        - Create database backup"
	@echo "  make clean         - Remove stopped containers and volumes"

prod-up:
	@echo "Starting production services..."
	docker compose -f docker-compose.prod.yml up -d --build

prod-down:
	@echo "Stopping production services..."
	docker compose -f docker-compose.prod.yml down

prod-restart:
	@echo "Restarting production services..."
	docker compose -f docker-compose.prod.yml restart

prod-logs:
	docker compose -f docker-compose.prod.yml logs -f

prod-status:
	docker compose -f docker-compose.prod.yml ps

backup:
	@echo "Creating database backup..."
	./backup-cron.sh

clean:
	@echo "Cleaning up..."
	docker compose -f docker-compose.prod.yml down -v
	docker system prune -f
