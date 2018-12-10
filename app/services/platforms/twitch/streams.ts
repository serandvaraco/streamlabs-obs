import { Observable } from 'rxjs/Observable';
import { ajax } from 'rxjs/observable/dom/ajax';
import 'rxjs/add/operator/map';
import { head } from 'fp-ts/lib/Array';
import { TwitchPagination } from './pagination';
import { TwitchRequestHeaders } from './tags';

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
  tag_ids: string[];
};

export type StreamsResponse = {
  data: Array<Stream>;
  pagination: TwitchPagination;
};

export const getUserStreams = (
  userId: string,
  headers: TwitchRequestHeaders
): Observable<Array<Stream>> =>
  ajax
    .getJSON<StreamsResponse>(`https://api.twitch.tv/helix/streams?user_id=${userId}`, headers)
    .map(response => response.data);

export const getStreamTags = (userId: string, headers: TwitchRequestHeaders) =>
  getUserStreams(userId, headers)
    .map(streams => head(streams).map(s => s.tag_ids).getOrElse([]))
    .toPromise();
