import { handleErrors } from '../../../util/requests';
import { TwitchPagination } from './pagination';

export type Stream = {
  id: string;
  user_id: string;
  user_name: string;
  game_id: string;
  community_ids: string[];
  type: string;
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string;
};

export type StreamsResponse = {
  data: Array<Stream>;
  pagination: TwitchPagination;
};

export const getUserStreams = (userId: string, headers: Headers): Promise<Array<Stream>> =>
  fetch(`https://api.twitch.tv/helix/streams?user_id=${userId}`, {
    headers
  })
    .then(handleErrors)
    .then<StreamsResponse>(response => response.json())
    .then(response => response.data);
