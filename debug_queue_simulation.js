
const generationQueue = {
    queue: [],
    processing: [],
    maxConcurrent: 2,
    discordBotStatus: {
        isAvailable: true,
        lastResponseTime: null,
        lastError: null,
        lastErrorTime: null,
        activeRequests: 0
    },
    userActiveJobs: new Map()
};

const JOB_TIMEOUT_MS = 2000; // Fast timeout for testing (2s)

function updateJobStatus(jobId, status) {
    console.log(`[Status Update] ${jobId}: ${status.status}`);
}

function getJobStatus(jobId) {
    return { params: {} };
}

function addToQueue(jobId, userId, userName, policyTableName) {
    const queueItem = {
        jobId, userId, userName, policyTableName,
        createdAt: new Date().toISOString(),
        queuePosition: generationQueue.queue.length + 1
    };
    generationQueue.queue.push(queueItem);
    console.log(`[Queue] Added ${jobId}`);
    return queueItem;
}

function removeFromQueue(jobId) {
    const index = generationQueue.queue.findIndex(item => item.jobId === jobId);
    if (index !== -1) {
        generationQueue.queue.splice(index, 1);
    }
}

function addToProcessing(jobId, userId, userName, policyTableName, discordRequestId = null) {
    const processingItem = {
        jobId, userId, userName, policyTableName,
        startedAt: new Date().toISOString()
    };
    generationQueue.processing.push(processingItem);
    console.log(`[Processing] Added ${jobId}, Count: ${generationQueue.processing.length}`);
}

function removeFromProcessing(jobId) {
    const index = generationQueue.processing.findIndex(item => item.jobId === jobId);
    if (index !== -1) {
        generationQueue.processing.splice(index, 1);
        console.log(`[Processing] Removed ${jobId}, Count: ${generationQueue.processing.length}`);
    }
}

// Mock Processing Function
async function processPolicyTableGeneration(jobId, params, discordRequestId) {
    console.log(`[Worker] Starting execution for ${jobId}`);

    // Simulate different scenarios based on Job ID
    if (jobId.includes('FAST')) {
        await new Promise(r => setTimeout(r, 100)); // Fast success
        return;
    }
    if (jobId.includes('HANG')) {
        await new Promise(r => setTimeout(r, 5000)); // Hangs longer than job timeout
        return;
    }
    if (jobId.includes('CRASH')) {
        throw new Error('Sync Crash!'); // Should be caught by promise wrapper?
    }
    if (jobId.includes('ERROR')) {
        await new Promise(r => setTimeout(r, 100));
        throw new Error('Async Error');
    }
}

let isProcessingQueue = false;
async function processQueue() {
    if (isProcessingQueue) {
        // console.log('Queue is busy');
        return;
    }
    isProcessingQueue = true;

    try {
        while (generationQueue.queue.length > 0 && generationQueue.processing.length < generationQueue.maxConcurrent) {
            const queueItem = generationQueue.queue[0];
            const { jobId, userId, userName, policyTableName } = queueItem;

            removeFromQueue(jobId);

            const jobStatus = getJobStatus(jobId);
            if (!jobStatus) continue;

            const params = jobStatus.params;
            const discordRequestId = 'REQ';

            addToProcessing(jobId, userId, userName, policyTableName, discordRequestId);

            updateJobStatus(jobId, { status: 'processing' });

            // Important: No await here!
            processPolicyTableGeneration(jobId, params, discordRequestId)
                .then(() => {
                    console.log(`[Worker] Finished ${jobId}`);
                    removeFromProcessing(jobId);
                    processQueue();
                })
                .catch(error => {
                    console.log(`[Worker] Failed ${jobId}: ${error.message}`);
                    removeFromProcessing(jobId);
                    processQueue();
                });
        }
    } finally {
        isProcessingQueue = false;
    }
}

function cleanStaleJobs() {
    const now = Date.now();
    const staleJobs = generationQueue.processing.filter(job => {
        const startTime = new Date(job.startedAt).getTime();
        return (now - startTime) > JOB_TIMEOUT_MS;
    });

    if (staleJobs.length > 0) {
        console.log(`[Cleaner] Found ${staleJobs.length} stale jobs`);
        staleJobs.forEach(job => {
            console.log(`[Cleaner] Killing ${job.jobId}`);
            removeFromProcessing(job.jobId);
            updateJobStatus(job.jobId, { status: 'failed', error: 'Timeout' });
        });
        processQueue();
    }
}

// === SCENARIO ===
async function runTest() {
    console.log('=== STARTING TEST ===');

    // Add jobs
    addToQueue('JOB_HANG_1', 'u1', 'User1', 'Table1'); // Will timeout
    addToQueue('JOB_HANG_2', 'u2', 'User2', 'Table2'); // Will timeout
    addToQueue('JOB_FAST_3', 'u3', 'User3', 'Table3'); // Should wait
    addToQueue('JOB_ERROR_4', 'u4', 'User4', 'Table4'); // Should run after cleanup

    processQueue();

    // Monitor
    let seconds = 0;
    const interval = setInterval(() => {
        seconds++;
        console.log(`--- T+${seconds}s | Processing: ${generationQueue.processing.length} | Queue: ${generationQueue.queue.length} ---`);
        cleanStaleJobs(); // Run cleaner every second for test speed

        if (seconds >= 10) {
            clearInterval(interval);
            console.log('=== TEST COMPLETE ===');
            process.exit(0);
        }
    }, 1000);
}

runTest();
