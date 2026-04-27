import { 
  Bot, 
  Code, 
  Globe,
  Sparkles,
  FileText,
  Lightbulb,
  type LucideProps
} from 'lucide-react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';

// Icon 映射
export const ICON_MAP: Record<string, ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>>> = {
  Bot,
  Sparkles,
  Code,
  FileText,
  Globe,
  Lightbulb,
};
