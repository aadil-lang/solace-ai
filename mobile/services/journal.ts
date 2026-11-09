import { apiService } from './api';
import {
  JournalEntry,
  JournalCreateInput,
  JournalUpdateInput,
  JournalReflectionResponse,
  JournalListResponse,
} from '@/types/journal';

export const journalService = {
  reflectOnJournal: async (transcript: string): Promise<JournalReflectionResponse> => {
    return apiService.reflectOnJournal(transcript);
  },

  saveJournalEntry: async (data: JournalCreateInput): Promise<JournalEntry> => {
    return apiService.saveJournalEntry(data);
  },

  getJournalEntries: async (limit = 50, offset = 0): Promise<JournalListResponse> => {
    return apiService.getJournalEntries(limit, offset);
  },

  getJournalEntry: async (id: string): Promise<JournalEntry> => {
    return apiService.getJournalEntry(id);
  },

  updateJournalEntry: async (id: string, data: JournalUpdateInput): Promise<JournalEntry> => {
    return apiService.updateJournalEntry(id, data);
  },

  deleteJournalEntry: async (id: string): Promise<void> => {
    return apiService.deleteJournalEntry(id);
  },
};

export default journalService;
