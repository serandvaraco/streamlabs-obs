import { Observable } from 'rxjs/Observable';
import { ajax } from 'rxjs/observable/dom/ajax';
import { map } from 'rxjs/operator/map';
import { TwitchPagination } from './pagination';
import { TwitchRequestHeaders } from './tags';
import 'rxjs/add/operator/map';

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

export const getUserStreams = (userId: string, headers: TwitchRequestHeaders) =>
  ajax
    .getJSON<StreamsResponse>(`https://api.twitch.tv/helix/streams?user_id=${userId}`, headers)
    .map(response => response.data);
