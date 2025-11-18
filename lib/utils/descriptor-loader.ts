type DescriptorJob = {
  networkId: string;
  endpoint: string;
  tlsEnabled: boolean;
  serviceName: string;
  priority: 'high' | 'normal';
  timestamp: number;
};

type DescriptorResult = {
  networkId: string;
  serviceName: string;
  service: any;
};

class DescriptorLoaderQueue {
  private queue: DescriptorJob[] = [];
  private loading: Set<string> = new Set();
  private loaded: Set<string> = new Set();
  private currentJob: DescriptorJob | null = null;
  private listeners: ((result: DescriptorResult) => void)[] = [];
  private maxConcurrent = 1;
  private delayBetweenJobs = 500;

  private getJobKey(job: DescriptorJob): string {
    return `${job.networkId}:${job.serviceName}`;
  }

  enqueue(job: DescriptorJob) {
    const jobKey = this.getJobKey(job);

    if (this.loaded.has(jobKey) || this.loading.has(jobKey)) {
      return;
    }

    const existingIndex = this.queue.findIndex(
      (j) => this.getJobKey(j) === jobKey
    );

    if (existingIndex >= 0) {
      if (job.priority === 'high' && this.queue[existingIndex].priority === 'normal') {
        this.queue[existingIndex].priority = 'high';
        this.sortQueue();
      }
      return;
    }

    this.queue.push(job);
    this.sortQueue();
    this.processQueue();
  }

  enqueueBatch(jobs: DescriptorJob[]) {
    for (const job of jobs) {
      const jobKey = this.getJobKey(job);
      if (this.loaded.has(jobKey) || this.loading.has(jobKey)) {
        continue;
      }
      const existingIndex = this.queue.findIndex(
        (j) => this.getJobKey(j) === jobKey
      );
      if (existingIndex >= 0) {
        continue;
      }
      this.queue.push(job);
    }
    this.sortQueue();
    this.processQueue();
  }

  private sortQueue() {
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority === 'high' ? -1 : 1;
      }
      return a.timestamp - b.timestamp;
    });
  }

  private async processQueue() {
    if (this.currentJob || this.queue.length === 0) {
      return;
    }

    this.currentJob = this.queue.shift()!;
    const jobKey = this.getJobKey(this.currentJob);
    this.loading.add(jobKey);

    try {
      console.log(`[DescriptorLoader] Loading ${this.currentJob.serviceName} (${this.currentJob.priority} priority, ${this.queue.length} remaining)`);

      const response = await fetch('/api/grpc/descriptor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: this.currentJob.endpoint,
          tlsEnabled: this.currentJob.tlsEnabled,
          serviceName: this.currentJob.serviceName,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.service) {
          this.loaded.add(jobKey);
          this.notifyListeners({
            networkId: this.currentJob.networkId,
            serviceName: this.currentJob.serviceName,
            service: data.service,
          });
          console.log(`[DescriptorLoader] Loaded ${this.currentJob.serviceName}`);
        }
      } else {
        console.error(`[DescriptorLoader] Failed to load ${this.currentJob.serviceName}: ${response.statusText}`);
      }
    } catch (err) {
      console.error(`[DescriptorLoader] Error loading ${this.currentJob.serviceName}:`, err);
    } finally {
      this.loading.delete(jobKey);
      this.currentJob = null;

      await new Promise((resolve) => setTimeout(resolve, this.delayBetweenJobs));

      this.processQueue();
    }
  }

  onDescriptorLoaded(listener: (result: DescriptorResult) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(result: DescriptorResult) {
    for (const listener of this.listeners) {
      listener(result);
    }
  }

  getQueueStats() {
    return {
      queued: this.queue.length,
      loading: this.loading.size,
      loaded: this.loaded.size,
      currentJob: this.currentJob?.serviceName || null,
    };
  }

  clear(networkId: string) {
    this.queue = this.queue.filter((j) => j.networkId !== networkId);
    const keysToRemove: string[] = [];
    this.loading.forEach((key) => {
      if (key.startsWith(`${networkId}:`)) {
        keysToRemove.push(key);
      }
    });
    keysToRemove.forEach((key) => this.loading.delete(key));

    const loadedKeysToRemove: string[] = [];
    this.loaded.forEach((key) => {
      if (key.startsWith(`${networkId}:`)) {
        loadedKeysToRemove.push(key);
      }
    });
    loadedKeysToRemove.forEach((key) => this.loaded.delete(key));
  }
}

export const descriptorLoader = new DescriptorLoaderQueue();
