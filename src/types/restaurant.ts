type Coordinate = {
  __typename: "Coordinate";
  latitude: number;
  longitude: number;
};

type RestaurantAddress = {
  __typename: "RestaurantAddress";
  country: string;
  locality: string;
  zipCode: string;
  street: string;
};

type RestaurantAggregateRatingsValues = {
  __typename: "RestaurantAggregateRatingsValues";
  ratingValue: number;
  reviewCount: number;
};

type RestaurantAggregateRatings = {
  __typename: "RestaurantAggregateRatings";
  thefork: RestaurantAggregateRatingsValues;
};

type RestaurantBadge = {
  __typename: "RestaurantBadge";
  badgeType: string;
  label: string;
};

type HighlightedTag = {
  __typename: "HighlightedTag";
  id: string;
  text: string;
  type: string;
};

type RestaurantPhoto = {
  __typename: "RestaurantPhoto";
  id: string;
  src: string;
  alt: string | null;
};

type Currency = {
  __typename: "Currency";
  isoCurrency: string;
};

type Restaurant = {
  __typename: "Restaurant";
  address: RestaurantAddress;
  aggregateRatings: RestaurantAggregateRatings;
  badges: RestaurantBadge[];
  topChart: null;
  acceptedCurrency: string;
  geolocation: Coordinate;
  highlightedTag: HighlightedTag[];
  legacyId: number;
  mainPhotoUrl: string;
  mainPhotoAlt: string;
  name: string;
  photos: RestaurantPhoto[];
  priceRangeLevel: number;
  averagePrice: number;
  currency: Currency;
  servesCuisine: string;
  slug: string;
  id: string;
};

type SearchMarketingOffer = {
  __typename: "SearchMarketingOffer";
  label: string;
  type: string;
  title: string;
  discountPercentage: number | null;
};

type SearchSnippetHighlight = {
  __typename: "SearchSnippetHighlight";
  length: number;
  offset: number;
};

type SearchSnippet = {
  __typename: "SearchSnippet";
  highlights: SearchSnippetHighlight[];
  text: string;
};

type Offer = {
  __typename: "Offer";
  discountPercentage: number;
  label: string;
};

type SearchTimeslot = {
  __typename: "SearchTimeslot";
  bestOffer: Offer;
  hasAvailability: boolean;
  canBurnYums: boolean;
  time: number;
};

export type SearchRestaurant = {
  __typename: "SearchRestaurant";
  restaurant: Restaurant;
  marketingOffer: SearchMarketingOffer;
  canBurnYums: boolean;
  snippets: SearchSnippet[];
  timeslots: SearchTimeslot[];
};
