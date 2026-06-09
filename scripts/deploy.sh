#!/bin/bash
# deploy.sh — Full AKS 3-Tier deployment helper
set -euo pipefail

RESOURCE_GROUP="${1:-rg-aks-3tier}"
ENVIRONMENT="${2:-prod}"
IMAGE_TAG="${3:-latest}"
ACR_NAME="devops3tieracr"
ACR_SERVER="${ACR_NAME}.azurecr.io"
AKS_CLUSTER="aks3tier-${ENVIRONMENT}"
NAMESPACE="app"

echo "🚀 Deploying AKS 3-Tier App"
echo "   Environment : ${ENVIRONMENT}"
echo "   Image Tag   : ${IMAGE_TAG}"
echo "   Cluster     : ${AKS_CLUSTER}"

# Get kubeconfig
az aks get-credentials -g ${RESOURCE_GROUP} -n ${AKS_CLUSTER} --overwrite-existing

# Apply all manifests
echo "▶ Applying namespace and config..."
kubectl apply -f k8s/namespace/namespace.yaml
kubectl apply -f k8s/configmaps/app-config.yaml

echo "▶ Deploying database tier..."
kubectl apply -f k8s/database/postgres-statefulset.yaml
kubectl apply -f k8s/redis/redis-statefulset.yaml
kubectl rollout status statefulset/postgres -n ${NAMESPACE} --timeout=120s
kubectl rollout status statefulset/redis    -n ${NAMESPACE} --timeout=60s

echo "▶ Deploying application tier..."
for SVC in frontend user-service product-service order-service; do
  sed -e "s|\$(ACR_NAME)|${ACR_SERVER}|g" \
      -e "s|\$(IMAGE_TAG)|${IMAGE_TAG}|g" \
      k8s/services/${SVC}/deployment.yaml | kubectl apply -f -
  kubectl apply -f k8s/services/${SVC}/hpa.yaml 2>/dev/null || true
  kubectl apply -f k8s/services/${SVC}/pdb.yaml 2>/dev/null || true
done

echo "▶ Applying ingress and network policies..."
kubectl apply -f k8s/ingress/ingress.yaml
kubectl apply -f k8s/services/networkpolicies.yaml

echo "▶ Waiting for all deployments..."
for DEP in frontend user-service product-service order-service; do
  kubectl rollout status deployment/${DEP} -n ${NAMESPACE} --timeout=180s
done

echo ""
echo "✅ Deployment complete!"
kubectl get pods,svc,hpa -n ${NAMESPACE}
