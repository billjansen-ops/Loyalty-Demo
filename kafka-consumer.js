/**
 * Kafka Consumer Integration for Loyalty Platform
 * 
 * This module provides event streaming integration with Apache Kafka,
 * allowing clients to send activity data via Kafka topics.
 * 
 * Usage:
 *   node kafka-consumer.js --config=./kafka-configs/client-name.json
 * 
 * Configuration file format:
 *   {
 *     "clientId": "loyalty-consumer",
 *     "brokers": ["broker1:9092", "broker2:9092"],
 *     "topics": ["activities"],
 *     "groupId": "loyalty-processor",
 *     "tenantId": 1,
 *     "mapper": "delta"  // which mapper to use
 *   }
 */

// const { Kafka } = require('kafkajs');  // Uncomment when ready

const API_BASE = process.env.API_BASE || 'http://localhost:4001';

// ============================================================================
// MESSAGE MAPPERS - One per client/format
// ============================================================================

const mappers = {
  
  /**
   * Generic/default mapper - expects our native format
   */
  default: (message) => ({
    member_link: message.member_link,
    activity_date: message.activity_date,
    molecules: message.molecules || {},
    tenant_id: message.tenant_id
  }),

  /**
   * Example: Delta Airlines format
   * Maps Delta's flight record format to our activity format
   */
  delta: (message) => ({
    member_link: message.ffn,                    // Their frequent flyer number field
    activity_date: message.flight_date,
    molecules: {
      carrier: message.marketing_carrier,
      flight_number: message.flight_num,
      origin: message.departure_airport,
      destination: message.arrival_airport,
      fare_class: message.booking_class,
      distance: message.segment_miles,
      ticket_number: message.ticket_nbr
    },
    tenant_id: null  // Set from config
  }),

  /**
   * Example: Hotel partner format
   */
  marriott: (message) => ({
    member_link: message.loyalty_id,
    activity_date: message.checkout_date,
    molecules: {
      partner: 'MARRIOTT',
      partner_program: message.brand_code,
      nights: message.total_nights,
      revenue: message.total_revenue
    },
    tenant_id: null
  }),

  /**
   * Example: Credit card transaction format
   */
  amex: (message) => ({
    member_link: message.cardmember_id,
    activity_date: message.transaction_date,
    molecules: {
      partner: 'AMEX',
      partner_program: message.product_code,
      spend: message.transaction_amount,
      merchant_category: message.mcc_code
    },
    tenant_id: null
  })

};

// ============================================================================
// IDEMPOTENCY - Prevent duplicate processing
// ============================================================================

const processedMessages = new Map();  // In production: use Redis or DB
const MESSAGE_TTL = 24 * 60 * 60 * 1000;  // 24 hours

function isDuplicate(messageId) {
  return processedMessages.has(messageId);
}

function markProcessed(messageId) {
  processedMessages.set(messageId, Date.now());
  
  // Cleanup old entries periodically
  if (processedMessages.size > 100000) {
    const cutoff = Date.now() - MESSAGE_TTL;
    for (const [id, timestamp] of processedMessages) {
      if (timestamp < cutoff) processedMessages.delete(id);
    }
  }
}

// ============================================================================
// ACTIVITY PROCESSOR - Calls our existing API
// ============================================================================

async function processActivity(activity, tenantId) {
  activity.tenant_id = activity.tenant_id || tenantId;
  
  const response = await fetch(`${API_BASE}/v1/activities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(activity)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`API error: ${error.error || response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// DEAD LETTER QUEUE - Handle failed messages
// ============================================================================

const deadLetterQueue = [];  // In production: separate Kafka topic or DB table

function sendToDeadLetter(message, error) {
  deadLetterQueue.push({
    message,
    error: error.message,
    timestamp: new Date().toISOString()
  });
  
  console.error(`[DLQ] Message failed: ${error.message}`);
  
  // In production: publish to dead letter topic
  // await producer.send({ topic: 'loyalty-dlq', messages: [{ value: JSON.stringify({...}) }] });
}

// ============================================================================
// MAIN CONSUMER
// ============================================================================

async function startConsumer(config) {
  console.log(`\n🚀 Starting Kafka Consumer`);
  console.log(`   Brokers: ${config.brokers.join(', ')}`);
  console.log(`   Topics: ${config.topics.join(', ')}`);
  console.log(`   Group ID: ${config.groupId}`);
  console.log(`   Mapper: ${config.mapper}`);
  console.log(`   Tenant ID: ${config.tenantId}\n`);

  const mapper = mappers[config.mapper] || mappers.default;

  /* Uncomment when ready to use:
  
  const kafka = new Kafka({
    clientId: config.clientId,
    brokers: config.brokers
  });

  const consumer = kafka.consumer({ groupId: config.groupId });

  await consumer.connect();
  
  for (const topic of config.topics) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const messageId = `${topic}-${partition}-${message.offset}`;
      
      // Skip duplicates
      if (isDuplicate(messageId)) {
        console.log(`[SKIP] Duplicate message: ${messageId}`);
        return;
      }

      try {
        const payload = JSON.parse(message.value.toString());
        const activity = mapper(payload);
        
        await processActivity(activity, config.tenantId);
        
        markProcessed(messageId);
        console.log(`[OK] Processed: ${messageId}`);
        
      } catch (error) {
        sendToDeadLetter({ topic, partition, offset: message.offset, value: message.value.toString() }, error);
      }
    }
  });

  console.log('✅ Consumer running. Press Ctrl+C to stop.\n');
  
  */
  
  console.log('⚠️  Kafka consumer is scaffolded but not active.');
  console.log('    Uncomment the consumer code when kafkajs is installed.\n');
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const configArg = args.find(a => a.startsWith('--config='));
  
  if (!configArg) {
    console.log('Usage: node kafka-consumer.js --config=./kafka-configs/client.json');
    console.log('\nExample config:');
    console.log(JSON.stringify({
      clientId: 'loyalty-consumer',
      brokers: ['localhost:9092'],
      topics: ['activities'],
      groupId: 'loyalty-processor',
      tenantId: 1,
      mapper: 'default'
    }, null, 2));
    process.exit(1);
  }

  const configPath = configArg.split('=')[1];
  const config = require(configPath);
  
  startConsumer(config).catch(console.error);
}

// ============================================================================
// EXPORTS - For programmatic use
// ============================================================================

module.exports = {
  startConsumer,
  mappers,
  processActivity,
  // For testing
  isDuplicate,
  markProcessed,
  deadLetterQueue
};
