@description('Application Insights resource ID')
param appInsightsId string

@description('Action Group name')
param actionGroupName string

@description('Action Group short name (12 characters max)')
@maxLength(12)
param actionGroupShortName string

@description('Email address for alert notifications')
param actionGroupEmail string

@description('Tags to apply')
param tags object = {}

@description('Enable alerts')
param enableAlerts bool = true

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: actionGroupName
  location: 'global'
  tags: tags
  properties: {
    groupShortName: actionGroupShortName
    enabled: enableAlerts
    emailReceivers: [
      {
        name: 'ops-email'
        emailAddress: actionGroupEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

resource availabilityAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-api-availability'
  location: 'global'
  tags: tags
  properties: {
    severity: 1
    enabled: enableAlerts
    scopes: [
      appInsightsId
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'AvailabilityPercentage'
          criterionType: 'StaticThresholdCriterion'
          metricName: 'availabilityResults/availabilityPercentage'
          operator: 'LessThan'
          threshold: 99
          timeAggregation: 'Average'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

resource errorRateAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-api-5xx-rate'
  location: 'global'
  tags: tags
  properties: {
    severity: 2
    enabled: enableAlerts
    scopes: [
      appInsightsId
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'FailedRequests'
          criterionType: 'StaticThresholdCriterion'
          metricName: 'requests/failed'
          operator: 'GreaterThan'
          threshold: 5
          timeAggregation: 'Count'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

output actionGroupId string = actionGroup.id
output alertIds array = [
  availabilityAlert.id
  errorRateAlert.id
]
