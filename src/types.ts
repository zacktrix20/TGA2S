export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  location?: {
    lat: number;
    lng: number;
    name: string;
  };
  createdAt: string;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  content: string;
  imageUrl?: string;
  likesCount: number;
  commentsCount: number;
  type: 'success' | 'question' | 'general';
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  content: string;
  createdAt: string;
}

export interface WeatherData {
  current: {
    temp: number;
    description: string;
    icon: string;
    humidity: number;
    windSpeed: number;
    pressure?: number;
    feelsLike?: number;
  };
  daily?: {
    date: string;
    tempMax: number;
    tempMin: number;
    description: string;
    icon: string;
    precipitationProbability: number;
    precipitationAmount?: number;
  }[];
  hourly: {
    time: string;
    temp: number;
    icon: string;
    precipitation?: number;
  }[];
  alerts: {
    event: string;
    description: string;
    severity?: 'high' | 'medium' | 'low';
    cropRecommendation?: string;
  }[];
  insights?: {
    bestPlantingMonth?: string;
    estimatedRainfall?: string;
    soilMoistureStatus?: 'dry' | 'moderate' | 'wet';
    farmingAdvice?: string;
  };
}

export interface FarmCrop {
  id: string;
  name: string;
  plantedDate: string;
  expectedHarvestDate: string;
  status: 'growing' | 'harvested' | 'failed';
}

export interface SoilData {
  ph: number;
  nitrogen: string; // 'low' | 'medium' | 'high'
  phosphorus: string;
  potassium: string;
  updatedAt: string;
}

export interface MarketPrice {
  crop: string;
  price: number;
  unit: string;
  location: string;
  trend: 'up' | 'down' | 'stable';
}
