// test-reflection.js
// Test script for native gRPC reflection implementation

async function testReflection() {
  console.log('Testing native gRPC reflection...\n');

  // Test endpoints
  const testCases = [
    {
      name: 'Juno (Basementnodes)',
      endpoint: 'grpc.juno.basementnodes.ca:443',
      tls: true,
    },
    {
      name: 'Cosmos Hub (cosmos.directory)',
      endpoint: 'grpc.cosmos.directory:443',
      tls: true,
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${testCase.name}`);
    console.log(`Endpoint: ${testCase.endpoint}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Test service discovery
      console.log('1. Testing service discovery...');
      const discoverResponse = await fetch('http://localhost:3000/api/grpc/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: testCase.endpoint,
          tls: testCase.tls,
        }),
      });

      if (!discoverResponse.ok) {
        const error = await discoverResponse.text();
        throw new Error(`Service discovery failed: ${error}`);
      }

      const discovery = await discoverResponse.json();
      console.log(`   ✓ Found ${discovery.services.length} services`);

      if (discovery.chainId) {
        console.log(`   ✓ Chain ID: ${discovery.chainId}`);
      }

      // Find a test method
      const bankService = discovery.services.find(s =>
        s.fullName === 'cosmos.bank.v1beta1.Query'
      );

      if (!bankService) {
        console.log('   ⚠ cosmos.bank.v1beta1.Query not found, skipping invocation test');
        continue;
      }

      const totalSupplyMethod = bankService.methods.find(m => m.name === 'TotalSupply');

      if (!totalSupplyMethod) {
        console.log('   ⚠ TotalSupply method not found, skipping invocation test');
        continue;
      }

      console.log(`   ✓ Found method: ${totalSupplyMethod.fullName}`);

      // Test method invocation
      console.log('\n2. Testing method invocation...');
      const invokeResponse = await fetch('http://localhost:3000/api/grpc/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: testCase.endpoint,
          tls: testCase.tls,
          service: 'cosmos.bank.v1beta1.Query',
          method: 'TotalSupply',
          params: {},
          timeout: 10000,
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

      console.log(`\n   ✅ ${testCase.name} - ALL TESTS PASSED\n`);

    } catch (error) {
      console.error(`\n   ❌ ${testCase.name} - FAILED:`);
      console.error(`   ${error.message}\n`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Testing complete!');
  console.log('='.repeat(60) + '\n');
}

// Run tests
testReflection().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
