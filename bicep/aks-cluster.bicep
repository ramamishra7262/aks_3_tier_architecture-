@description('AKS 3-Tier Architecture — Cluster + ACR + Key Vault')
param location string = resourceGroup().location
param environment string = 'prod'
param kubernetesVersion string = '1.28.5'
param systemNodeVmSize string = 'Standard_D2s_v3'
param userNodeVmSize string = 'Standard_D4s_v3'
param userNodeCount int = 3

var prefix = 'aks3tier'

// ── Azure Container Registry ──────────────────────────────────────────────────
resource acr 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: '${prefix}acr'
  location: location
  sku: { name: 'Premium' }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
    policies: {
      retentionPolicy: { days: 30, status: 'enabled' }
    }
  }
}

// ── Log Analytics for Container Insights ─────────────────────────────────────
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: 'law-${prefix}-${environment}'
  location: location
  properties: { sku: { name: 'PerGB2018' }; retentionInDays: 30 }
}

// ── AKS Cluster ───────────────────────────────────────────────────────────────
resource aks 'Microsoft.ContainerService/managedClusters@2023-10-01' = {
  name: '${prefix}-${environment}'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    dnsPrefix: '${prefix}-${environment}'
    kubernetesVersion: kubernetesVersion
    enableRBAC: true

    agentPoolProfiles: [
      {
        name: 'system'
        count: 1
        vmSize: systemNodeVmSize
        mode: 'System'
        osType: 'Linux'
        osDiskSizeGB: 30
        enableAutoScaling: false
        availabilityZones: ['1','2','3']
        nodeTaints: ['CriticalAddonsOnly=true:NoSchedule']
      }
      {
        name: 'userpool'
        count: userNodeCount
        vmSize: userNodeVmSize
        mode: 'User'
        osType: 'Linux'
        osDiskSizeGB: 50
        enableAutoScaling: true
        minCount: 2
        maxCount: 10
        availabilityZones: ['1','2','3']
      }
    ]

    networkProfile: {
      networkPlugin: 'azure'
      networkPolicy: 'azure'
      loadBalancerSku: 'standard'
    }

    addonProfiles: {
      omsagent: {
        enabled: true
        config: { logAnalyticsWorkspaceResourceID: logAnalytics.id }
      }
      azureKeyvaultSecretsProvider: {
        enabled: true
        config: { enableSecretRotation: 'true' }
      }
    }

    oidcIssuerProfile: { enabled: true }
    securityProfile: {
      workloadIdentity: { enabled: true }
      defender: {
        logAnalyticsWorkspaceResourceId: logAnalytics.id
        securityMonitoring: { enabled: true }
      }
    }

    autoUpgradeProfile: { upgradeChannel: 'patch' }
  }
  tags: { environment: environment, managedBy: 'bicep' }
}

// Grant AKS kubelet pull access to ACR
resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: acr
  name: guid(acr.id, aks.id, 'acrpull')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: aks.properties.identityProfile.kubeletidentity.objectId
    principalType: 'ServicePrincipal'
  }
}

output aksClusterName string = aks.name
output acrLoginServer string = acr.properties.loginServer
output logAnalyticsWorkspaceId string = logAnalytics.properties.customerId
