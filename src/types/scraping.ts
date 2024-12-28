export interface ScrapingPattern {
  version: string;
  instructions: string;
  schema: string;
  lastUpdated: number;
}

export interface ScrapingInstruction {
  selector: string;
  type: "text" | "attribute" | "exists";
  attribute?: string;
  transform?: string;
  required?: boolean;
}

export interface ScrapingInstructions {
  containerSelector?: string;
  fields: Record<string, ScrapingInstruction>;
  isArray: boolean;
}

export interface GeneratedPattern {
  version: string;
  instructions: ScrapingInstructions;
}
