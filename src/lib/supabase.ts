import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://etzvqfomlaricolfzoec.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_t69DyxOo3S54rmVIyvP2-A_PKNtSmm7';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);