output "vpc_id" {
  description = "VPC id"
  value       = aws_vpc.this.id
}

output "public_subnet_ids" {
  description = "Public subnet ids"
  value       = [for s in aws_subnet.public : s.id]
}

output "private_subnet_ids" {
  description = "Private subnet ids"
  value       = [for s in aws_subnet.private : s.id]
}

output "alb_dns_name" {
  description = "Public ALB DNS name"
  value       = aws_lb.public.dns_name
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.this.name
}
