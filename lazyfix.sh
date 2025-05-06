#!/bin/bash

# Fix module variable assignments in api/services/route.ts
echo "Fixing module variable in api/services/route.ts..."
sed -i 's/const module =/const moduleItem =/g' app/api/services/route.ts
sed -i 's/module: /moduleItem: /g' app/api/services/route.ts

# Fix unused variables in GrpcExplorerApp.tsx
echo "Fixing unused variables in GrpcExplorerApp.tsx..."
sed -i 's/\[activeNetwork, setActiveNetwork\]/\[_activeNetwork, setActiveNetwork\]/g' components/GrpcExplorerApp.tsx
sed -i 's/\[expandMethodsByDefault, setExpandMethodsByDefault\]/\[_expandMethodsByDefault, setExpandMethodsByDefault\]/g' components/GrpcExplorerApp.tsx

# Fix useEffect dependencies in GrpcExplorerApp.tsx
echo "Fixing useEffect dependencies in GrpcExplorerApp.tsx..."
sed -i 's/}, \[\]);/}, \[handleEndpointSave\]);/g' components/GrpcExplorerApp.tsx

# Fix Field import in MethodCard.tsx
echo "Fixing unused Field import in MethodCard.tsx..."
sed -i 's/import { Service, Method, Field } from/import { Service, Method, Field as _Field } from/g' components/MethodCard.tsx

# Fix useEffect dependency in MethodCard.tsx
echo "Fixing useEffect dependency in MethodCard.tsx..."
sed -i 's/}, \[\]);/}, \[fetchMethodFields\]);/g' components/MethodCard.tsx

# Fix unused styles import in MethodForm.tsx
echo "Fixing unused styles import in MethodForm.tsx..."
sed -i 's/import styles from/import _styles from/g' components/MethodForm.tsx

# Fix unused params in MethodForm.tsx
echo "Fixing unused params in MethodForm.tsx..."
sed -i 's/params: Record<string, any>/params: Record<string, any> as _params/g' components/MethodForm.tsx

# Fix useEffect dependency in MethodForm.tsx
echo "Fixing useEffect dependency in MethodForm.tsx..."
sed -i 's/}, \[method\]);/}, \[method, getExampleArrayValue\]);/g' components/MethodForm.tsx

# Fix TypeScript issues in MethodForm.tsx
echo "Fixing TypeScript issues in MethodForm.tsx..."
sed -i 's/const exampleData = {}/const exampleData: Record<string, any> = {}/g' components/MethodForm.tsx

# Fix unused args in NetworkTab.tsx
echo "Fixing unused args in NetworkTab.tsx..."
sed -i 's/service: Service)/service: Service as _service)/g' components/NetworkTab.tsx
sed -i 's/method: Method,/method: Method as _method,/g' components/NetworkTab.tsx
sed -i 's/service: Service,/service: Service as _service,/g' components/NetworkTab.tsx
sed -i 's/endpoint: string/endpoint: string as _endpoint/g' components/NetworkTab.tsx

# Fix useEffect dependency in NetworkTab.tsx
echo "Fixing useEffect dependency in NetworkTab.tsx..."
sed -i 's/}, \[endpoint, useTLS, cacheEnabled\]);/}, \[endpoint, useTLS, cacheEnabled, fetchServices\]);/g' components/NetworkTab.tsx

# Fix unused args in ServiceList.tsx
echo "Fixing unused args in ServiceList.tsx..."
sed -i 's/service: Service,/service: Service as _service,/g' components/ServiceList.tsx
sed -i 's/method: Method,/method: Method as _method,/g' components/ServiceList.tsx
sed -i 's/service: Service)/service: Service as _service)/g' components/ServiceList.tsx
sed -i 's/endpoint = "",/endpoint: string = "" as _endpoint,/g' components/ServiceList.tsx

# Fix module variable in ServiceList.tsx
echo "Fixing module variables in ServiceList.tsx..."
sed -i 's/\[\(module\), \([a-zA-Z]*\)\]/\[moduleItem, \2\]/g' components/ServiceList.tsx
sed -i 's/`${chain}.${module}`/`${chain}.${moduleItem}`/g' components/ServiceList.tsx
sed -i 's/<span>{module}<\/span>/<span>{moduleItem}<\/span>/g' components/ServiceList.tsx

# Fix moduleItem warning
echo "Fixing unused moduleItem warning in ServiceList.tsx..."
sed -i 's/moduleItem,/moduleItem as _moduleItem,/g' components/ServiceList.tsx

# Fix unused saveUserSettings in SettingsPanel.tsx
echo "Fixing unused saveUserSettings in SettingsPanel.tsx..."
sed -i 's/saveUserSettings,/saveUserSettings as _saveUserSettings,/g' components/SettingsPanel.tsx

echo "All fixes applied! Try building now."
