apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: thumbnail-storage
spec:
  type: bindings.azure.blobstorage
  version: v1
  metadata:
    - name: connectionString
      value: "UseDevelopmentStorage=true"
    - name: containerName
      value: "thumbnails"
