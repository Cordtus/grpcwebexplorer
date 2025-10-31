// test-grpc-reflection.js
// Comprehensive test script for gRPC reflection implementation

async function testGrpcReflection() {
  console.log('Testing gRPC Reflection Client...\n');

  // Test endpoints
  const testCases = [
    {
      name: 'Juno (Basementnodes)',
      endpoint: 'grpc.juno.basementnodes.ca:443',
      tlsEnabled: true,
    },
    {
      name: 'Cosmos Hub (cosmos.directory)',
      endpoint: 'grpc.cosmos.directory:443',
      tlsEnabled: true,
    },
  ];

  let passedTests = 0;
  let failedTests = 0;

  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${testCase.name}`);
    console.log(`Endpoint: ${testCase.endpoint}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Test 1: Service discovery
      console.log('1. Testing service discovery...');
      const discoverResponse = await fetch('http://localhost:3000/api/grpc/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: testCase.endpoint,
          tlsEnabled: testCase.tlsEnabled,
          forceRefresh: true,
        }),
      });

      if (!discoverResponse.ok) {
        const error = await discoverResponse.text();
        throw new Error(`Service discovery failed: ${error}`);
      }

      const discovery = await discoverResponse.json();
      console.log(`   ✓ Found ${discovery.services.length} services`);
      console.log(`   ✓ Completion rate: ${discovery.status.completionRate}%`);

      if (discovery.chainId) {
        console.log(`   ✓ Chain ID: ${discovery.chainId}`);
      }

      // Test 2: Verify type definitions are present
      console.log('\n2. Testing type definition extraction...');
      const bankService = discovery.services.find(s =>
        s.fullName === 'cosmos.bank.v1beta1.Query'
      );

      if (!bankService) {
        console.log('   ⚠ cosmos.bank.v1beta1.Query not found, skipping type def test');
      } else {
        const totalSupplyMethod = bankService.methods.find(m => m.name === 'TotalSupply');

        if (!totalSupplyMethod) {
          console.log('   ⚠ TotalSupply method not found');
        } else {
          // Verify requestTypeDefinition exists
          if (!totalSupplyMethod.requestTypeDefinition) {
            throw new Error('Missing requestTypeDefinition');
          }
          console.log(`   ✓ Request type: ${totalSupplyMethod.requestTypeDefinition.name}`);
          console.log(`   ✓ Request fields: ${totalSupplyMethod.requestTypeDefinition.fields.length}`);

          // Verify responseTypeDefinition exists
          if (!totalSupplyMethod.responseTypeDefinition) {
            throw new Error('Missing responseTypeDefinition');
          }
          console.log(`   ✓ Response type: ${totalSupplyMethod.responseTypeDefinition.name}`);
          console.log(`   ✓ Response fields: ${totalSupplyMethod.responseTypeDefinition.fields.length}`);

          // Test 3: Method invocation
          console.log('\n3. Testing method invocation...');
          const invokeResponse = await fetch('http://localhost:3000/api/grpc/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint: testCase.endpoint,
              tlsEnabled: testCase.tlsEnabled,
              service: 'cosmos.bank.v1beta1.Query',
              method: 'TotalSupply',
              params: {},
            }),
          });

          if (!invokeResponse.ok) {
            const error = await invokeResponse.text();
            throw new Error(`Method invocation failed: ${error}`);
          }

          const invocation = await invokeResponse.json();
          console.log(`   ✓ Method executed in ${invocation.executionTime}ms`);

          if (invocation.result && invocation.result.supply) {
            console.log(`   ✓ Total supply entries: ${invocation.result.supply.length}`);

            // Show first few denoms
            const firstDenoms = invocation.result.supply.slice(0, 3);
            console.log(`   ✓ Sample denoms:`);
            for (const coin of firstDenoms) {
              console.log(`      - ${coin.denom}: ${coin.amount}`);
            }
          }
        }
      }

      // Test 4: Enum handling
      console.log('\n4. Testing enum field detection...');
      let foundEnum = false;
      for (const service of discovery.services) {
        for (const method of service.methods) {
          for (const field of method.requestTypeDefinition.fields) {
            if (field.enumValues && field.enumValues.length > 0) {
              console.log(`   ✓ Found enum field: ${field.name} in ${method.fullName}`);
              console.log(`   ✓ Enum values: ${field.enumValues.join(', ')}`);
              foundEnum = true;
              break;
            }
          }
          if (foundEnum) break;
        }
        if (foundEnum) break;
      }
      if (!foundEnum) {
        console.log('   ⚠ No enum fields found in available methods');
      }

      console.log(`\n   ✅ ${testCase.name} - ALL TESTS PASSED\n`);
      passedTests++;

    } catch (error) {
      console.error(`\n   ❌ ${testCase.name} - FAILED:`);
      console.error(`   ${error.message}\n`);
      failedTests++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test Summary:');
  console.log(`  Passed: ${passedTests}/${testCases.length}`);
  console.log(`  Failed: ${failedTests}/${testCases.length}`);
  console.log('='.repeat(60) + '\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

// Run tests
testGrpcReflection().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
