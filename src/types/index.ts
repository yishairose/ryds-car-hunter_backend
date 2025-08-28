export type SearchParams = {
  make: string;
  model: string;
  minPrice?: number;
  maxPrice?: number;
  minMileage?: number;
  maxMileage?: number;
  color?: string;
  minAge?: number; // in years
  maxAge?: number; // in years
  vatQualifying?: boolean; // VAT qualification filter
};

export type LoginCredentials = {
  username: string;
  password: string;
};
