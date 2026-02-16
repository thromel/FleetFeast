locals {
  tags = merge(
    {
      ManagedBy = "terraform"
      Service   = "runtime-baseline"
    },
    var.common_tags,
  )
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(local.tags, { Name = "${var.name_prefix}-vpc" })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(local.tags, { Name = "${var.name_prefix}-igw" })
}

resource "aws_subnet" "public" {
  count = length(var.public_subnet_cidrs)

  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.tags, { Name = "${var.name_prefix}-public-${count.index + 1}" })
}

resource "aws_subnet" "private" {
  count = length(var.private_subnet_cidrs)

  vpc_id            = aws_vpc.this.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = merge(local.tags, { Name = "${var.name_prefix}-private-${count.index + 1}" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = merge(local.tags, { Name = "${var.name_prefix}-public-rt" })
}

resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "alb" {
  name        = "${var.name_prefix}-alb-sg"
  description = "Security group for ALB"
  vpc_id      = aws_vpc.this.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}

resource "aws_security_group" "ecs" {
  name        = "${var.name_prefix}-ecs-sg"
  description = "Security group for ECS tasks"
  vpc_id      = aws_vpc.this.id

  ingress {
    from_port       = var.core_api_port
    to_port         = var.dispatch_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}

resource "aws_lb" "public" {
  name               = substr("${var.name_prefix}-alb", 0, 32)
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.alb.id]
  subnets            = [for s in aws_subnet.public : s.id]

  tags = local.tags
}

resource "aws_lb_target_group" "core_api" {
  name        = substr("${var.name_prefix}-core-tg", 0, 32)
  port        = var.core_api_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.this.id

  health_check {
    path = "/"
  }

  tags = local.tags
}

resource "aws_lb_target_group" "dispatch" {
  name        = substr("${var.name_prefix}-dispatch-tg", 0, 32)
  port        = var.dispatch_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.this.id

  health_check {
    path = "/"
  }

  tags = local.tags
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.public.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.core_api.arn
  }
}

resource "aws_lb_listener_rule" "dispatch_path" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.dispatch.arn
  }

  condition {
    path_pattern {
      values = ["/dispatch*", "/telemetry*"]
    }
  }
}

resource "aws_ecs_cluster" "this" {
  name = "${var.name_prefix}-cluster"

  tags = local.tags
}

resource "aws_cloudwatch_log_group" "core_api" {
  name              = "/ecs/${var.name_prefix}/core-api"
  retention_in_days = 30

  tags = local.tags
}

resource "aws_cloudwatch_log_group" "dispatch" {
  name              = "/ecs/${var.name_prefix}/dispatch"
  retention_in_days = 30

  tags = local.tags
}

resource "aws_ecs_task_definition" "core_api" {
  family                   = "${var.name_prefix}-core-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = null
  task_role_arn            = null

  container_definitions = jsonencode([
    {
      name  = "core-api"
      image = var.core_api_container_image
      portMappings = [
        {
          containerPort = var.core_api_port
          hostPort      = var.core_api_port
          protocol      = "tcp"
        }
      ]
      essential = true
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.core_api.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  tags = local.tags
}

resource "aws_ecs_task_definition" "dispatch" {
  family                   = "${var.name_prefix}-dispatch"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = null
  task_role_arn            = null

  container_definitions = jsonencode([
    {
      name  = "dispatch"
      image = var.dispatch_container_image
      portMappings = [
        {
          containerPort = var.dispatch_port
          hostPort      = var.dispatch_port
          protocol      = "tcp"
        }
      ]
      essential = true
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.dispatch.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  tags = local.tags
}

resource "aws_ecs_service" "core_api" {
  name            = "${var.name_prefix}-core-api"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.core_api.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [for s in aws_subnet.public : s.id]
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.core_api.arn
    container_name   = "core-api"
    container_port   = var.core_api_port
  }

  depends_on = [aws_lb_listener.http]

  tags = local.tags
}

resource "aws_ecs_service" "dispatch" {
  name            = "${var.name_prefix}-dispatch"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.dispatch.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [for s in aws_subnet.public : s.id]
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.dispatch.arn
    container_name   = "dispatch"
    container_port   = var.dispatch_port
  }

  depends_on = [aws_lb_listener_rule.dispatch_path]

  tags = local.tags
}
