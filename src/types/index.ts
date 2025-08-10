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
};

export type LoginCredentials = {
  username: string;
  password: string;
};
