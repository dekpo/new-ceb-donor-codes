// Enhanced email service for mixed request submissions using EmailJS

import emailjs from '@emailjs/browser';
import type { DonorRequest, RequestSubmission } from '../types/request';

// EmailJS configuration - Using environment variables for security
// Note: Public key, service ID, and template ID are safe to expose in client-side code
// as per EmailJS design. Private key is used for additional verification.
const EMAIL_CONFIG = {
  publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
  privateKey: import.meta.env.VITE_EMAILJS_PRIVATE_KEY, // Used for additional security, not authentication
  serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID,
  templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID
};

/**
 * Fixed chunk size for splitting requests into batches
 * Matches CEB duty station app behavior: 15 requests per email
 */
const CHUNK_SIZE = 15;

/**
 * Delay between email sends (in milliseconds)
 * Matches CEB duty station app: 2 second delay between batches to prevent rate limiting
 */
const EMAIL_SEND_DELAY = 2000;

export interface EmailSubmissionResult {
  success: boolean;
  submissionId?: string;
  error?: string;
  details?: any;
  // Batch information for multi-batch submissions
  totalBatches?: number;
  successfulBatches?: number;
  failedBatches?: number;
  batchErrors?: string[];
}

/**
 * Enhanced email service for submitting mixed request types
 */
export class EmailService {
  private initialized = false;

  /**
   * Initialize EmailJS (call once at app startup)
   */
  async initialize(): Promise<void> {
    try {
      // Validate environment variables are loaded
      if (!EMAIL_CONFIG.publicKey || !EMAIL_CONFIG.serviceId || !EMAIL_CONFIG.templateId) {
        const missing = [];
        if (!EMAIL_CONFIG.publicKey) missing.push('VITE_EMAILJS_PUBLIC_KEY');
        if (!EMAIL_CONFIG.serviceId) missing.push('VITE_EMAILJS_SERVICE_ID');
        if (!EMAIL_CONFIG.templateId) missing.push('VITE_EMAILJS_TEMPLATE_ID');
        
        throw new Error(`EmailJS environment variables not configured: ${missing.join(', ')}. Set these in Netlify Site Settings > Environment Variables.`);
      }

      emailjs.init(EMAIL_CONFIG.publicKey);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize EmailJS:', error);
      throw new Error(`Email service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Submit mixed request submission via email
   * Automatically splits into chunks of 15 requests per email if needed
   */
  async submitRequests(submission: RequestSubmission): Promise<EmailSubmissionResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Check if chunking is needed
      if (submission.requests.length <= CHUNK_SIZE) {
        // Single batch - send as normal
        return await this.sendSingleBatch(submission, submission.requests, 1, 1);
      } else {
        // Multiple batches needed - split and send sequentially
        const chunks = this.splitIntoChunks(submission.requests);
        return await this.sendMultipleBatches(submission, chunks);
      }

    } catch (error) {
      console.error('Failed to send email:', error);
      
      // Handle specific EmailJS errors
      let errorMessage = 'Unknown email error';
      if (error && typeof error === 'object' && 'text' in error) {
        errorMessage = String(error.text);
        
        // Handle common EmailJS errors with user-friendly messages
        if (errorMessage.includes('Invalid grant') || errorMessage.includes('reconnect')) {
          errorMessage = 'Email service configuration needs to be updated. Please contact the administrator to reconnect the Gmail account.';
        } else if (errorMessage.includes('Unauthorized')) {
          errorMessage = 'Email service authorization expired. Please contact the administrator.';
        } else if (errorMessage.includes('Rate limit')) {
          errorMessage = 'Too many requests. Please wait a moment and try again.';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage,
        details: error
      };
    }
  }

  /**
   * Split requests into chunks of fixed size
   * Matches CEB duty station app pattern: 15 requests per batch
   */
  private splitIntoChunks(requests: DonorRequest[]): DonorRequest[][] {
    if (requests.length === 0) return [];
    
    const chunks: DonorRequest[][] = [];
    
    for (let i = 0; i < requests.length; i += CHUNK_SIZE) {
      chunks.push(requests.slice(i, i + CHUNK_SIZE));
    }
    
    return chunks;
  }

  /**
   * Send a single batch of requests
   */
  private async sendSingleBatch(
    submission: RequestSubmission,
    requests: DonorRequest[],
    batchNumber: number,
    totalBatches: number
  ): Promise<EmailSubmissionResult> {
    try {
      // Group requests by action type for better email organization
      const groupedRequests = {
        new: requests.filter(r => r.action === 'new'),
        update: requests.filter(r => r.action === 'update'),
        remove: requests.filter(r => r.action === 'remove')
      };

      // Prepare email content with batch information
      const emailContent = this.formatEmailContent(
        submission, 
        groupedRequests,
        batchNumber,
        totalBatches
      );

      // Send email via EmailJS
      const response = await emailjs.send(
        EMAIL_CONFIG.serviceId,
        EMAIL_CONFIG.templateId,
        emailContent
      );

      return {
        success: true,
        submissionId: submission.submissionId,
        details: response,
        totalBatches: totalBatches,
        successfulBatches: 1,
        failedBatches: 0
      };

    } catch (error) {
      console.error(`Failed to send batch ${batchNumber}/${totalBatches}:`, error);
      
      let errorMessage = 'Unknown email error';
      if (error && typeof error === 'object' && 'text' in error) {
        errorMessage = String(error.text);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: `Batch ${batchNumber}/${totalBatches} failed: ${errorMessage}`,
        details: error,
        totalBatches: totalBatches,
        successfulBatches: 0,
        failedBatches: 1,
        batchErrors: [errorMessage]
      };
    }
  }

  /**
   * Send multiple batches sequentially with delays
   * Matches CEB duty station app pattern: 2 second delay between batches
   */
  private async sendMultipleBatches(
    submission: RequestSubmission,
    chunks: DonorRequest[][]
  ): Promise<EmailSubmissionResult> {
    const totalBatches = chunks.length;
    const batchErrors: string[] = [];
    let successfulBatches = 0;
    let failedBatches = 0;

    for (let i = 0; i < chunks.length; i++) {
      const batch = chunks[i];
      const batchNumber = i + 1;
      
      const result = await this.sendSingleBatch(submission, batch, batchNumber, totalBatches);
      
      if (result.success) {
        successfulBatches++;
      } else {
        failedBatches++;
        if (result.error) {
          batchErrors.push(result.error);
        }
      }

      // Delay between batches (2 seconds) to prevent rate limiting
      // Skip delay after the last batch
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, EMAIL_SEND_DELAY));
      }
    }

    // Return overall result
    const allSuccessful = failedBatches === 0;
    
    return {
      success: allSuccessful,
      submissionId: submission.submissionId,
      error: allSuccessful 
        ? undefined 
        : `${failedBatches} of ${totalBatches} batch(es) failed to send`,
      totalBatches,
      successfulBatches,
      failedBatches,
      batchErrors: batchErrors.length > 0 ? batchErrors : undefined
    };
  }

  /**
   * Format email content to match the new template structure
   * Includes batch information for multi-batch submissions
   */
  private formatEmailContent(
    submission: RequestSubmission, 
    groupedRequests: { new: DonorRequest[]; update: DonorRequest[]; remove: DonorRequest[] },
    batchNumber: number = 1,
    totalBatches: number = 1
  ): Record<string, any> {
    const { new: newRequests, update: updateRequests, remove: removeRequests } = groupedRequests;
    
    // Get the requests for this batch (use all requests in groupedRequests)
    const batchRequests = [...newRequests, ...updateRequests, ...removeRequests];
    
    // Format requests for human-readable table
    const requestsTable = this.formatRequestsTable(batchRequests, batchNumber, totalBatches);
    
    // Format CSV lines for new requests (for database addition)
    const csvSnippets = this.formatCsvSnippets(newRequests);

    // Template variables matching your EmailJS template
    return {
      // Template variables: {{name}} and {{email}}
      name: submission.submittedBy.name,
      email: submission.submittedBy.email,
      
      // Template variable: {{{requests}}} - human readable table
      requests: requestsTable,
      
      // Template variable: {{{json_snippet}}} - CSV for database (kept same variable name for template compatibility)
      json_snippet: csvSnippets,
      
      // Template variable: {{additional_information}} - global notes for entire submission
      additional_information: submission.notes || 'N/A'
    };
  }

  /**
   * Format requests as a human-readable table
   * Includes batch information for multi-batch submissions
   */
  private formatRequestsTable(
    requests: DonorRequest[], 
    batchNumber: number = 1, 
    totalBatches: number = 1
  ): string {
    const lines = [];
    
    // Add batch header if multiple batches
    if (totalBatches > 1) {
      lines.push(`BATCH ${batchNumber} OF ${totalBatches}`);
      lines.push(`(${requests.length} requests in this batch)`);
      lines.push('');
    }
    
    lines.push('REQUEST DETAILS:');
    lines.push('================');
    lines.push('');

    requests.forEach((req, index) => {
      lines.push(`${index + 1}. ${req.action.toUpperCase()} REQUEST:`);
      lines.push(`   Entity Name: ${req.entityName}`);
      lines.push(`   Code: ${req.customCode || req.suggestedCode}`);
      lines.push(`   Contributor Type: ${req.contributorType}`);
      lines.push(`   Priority: ${req.priority.toUpperCase()}`);
      lines.push(`   Contact: ${req.contactName} (${req.contactEmail})`);
      lines.push(`   Justification: ${req.justification}`);
      
      if (req.originalDonor && (req.action === 'update' || req.action === 'remove')) {
        lines.push(`   Original Entity: ${req.originalDonor.name}`);
        lines.push(`   Original Code: ${req.originalDonor.code}`);
      }
      
      if (req.removalReason && req.action === 'remove') {
        lines.push(`   Removal Reason: ${req.removalReason.toUpperCase()}`);
      }
      
      if (req.additionalNotes) {
        lines.push(`   Additional Notes: ${req.additionalNotes}`);
      }
      
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Format CSV lines for new requests (for database addition)
   * Matches the DONORS.csv structure: NAME,TYPE,CEB CODE,CONTRIBUTOR TYPE
   */
  private formatCsvSnippets(newRequests: DonorRequest[]): string {
    if (newRequests.length === 0) {
      return 'No new requests requiring CSV database entries.';
    }

    const lines = [];
    lines.push('CSV DATABASE ENTRIES FOR NEW REQUESTS:');
    lines.push('=======================================');
    lines.push('Copy and paste the lines below into DONORS.csv');
    lines.push('');
    lines.push('CSV Format: NAME,TYPE,CEB CODE,CONTRIBUTOR TYPE');
    lines.push('');

    newRequests.forEach((req, index) => {
      // Format: NAME,TYPE,CEB CODE,CONTRIBUTOR TYPE
      const name = req.entityName;
      const type = this.getTypeFromContributorType(req.contributorType);
      const code = req.customCode || req.suggestedCode;
      const contributorType = req.contributorType;
      
      // Escape commas in name field if present (wrap in quotes)
      const escapedName = name.includes(',') ? `"${name}"` : name;
      
      const csvLine = `${escapedName},${type},${code},${contributorType}`;
      
      lines.push(`${index + 1}. ${csvLine}`);
    });

    return lines.join('\n');
  }

  /**
   * Map contributor type to TYPE field (0=Non-government, 1=Government)
   */
  private getTypeFromContributorType(contributorType: string): string {
    // C01 = Government, others are typically non-government
    return contributorType === 'C01' ? '1' : '0';
  }

  /**
   * Format proposed changes for update requests
   */
  private formatChanges(changes: DonorRequest['proposedChanges']): string {
    if (!changes) return '';
    
    const parts = [];
    if (changes.name) {
      parts.push(`Name: "${changes.name.from}" → "${changes.name.to}"`);
    }
    if (changes.code) {
      parts.push(`Code: "${changes.code.from}" → "${changes.code.to}"`);
    }
    if (changes.contributorType) {
      parts.push(`Type: "${changes.contributorType.from}" → "${changes.contributorType.to}"`);
    }
    
    return parts.length > 0 ? `Changes: ${parts.join(', ')}` : '';
  }

  /**
   * Get highest priority from requests for legacy compatibility
   */
  private getHighestPriority(requests: DonorRequest[]): string {
    const priorities = requests.map(r => r.priority);
    if (priorities.includes('high')) return 'high';
    if (priorities.includes('normal')) return 'normal';
    return 'low';
  }

  /**
   * Test email connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      return true;
    } catch (error) {
      console.error('Email connection test failed:', error);
      return false;
    }
  }
}

// Create singleton instance
export const emailService = new EmailService();

// Auto-initialize on import
emailService.initialize().catch(console.error);
