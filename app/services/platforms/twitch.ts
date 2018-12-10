import { Service } from 'services/service';
import { HostsService } from 'services/hosts';
import { SettingsService } from 'services/settings';
import { Inject } from 'util/injector';
import { authorizedHeaders, handleErrors, requiresToken } from 'util/requests';
import { UserService } from 'services/user';
import { head } from 'fp-ts/lib/Array';
import { delay, flatMap, map } from 'rxjs/operators';
import { of } from 'rxjs/observable/of';
import { StreamingContext } from '../streaming';
import { getUserStreams, getStreamTags } from './twitch/streams';
import {
  getAllTags,
  TwitchRequestHeaders,
  updateTags
} from './twitch/tags';
import { IChannelInfo, IGame, IPlatformAuth, IPlatformService } from '.';

/**
 * Delay that it takes for Twitch to recognize a stream going live/offline in
 * their stream APIs. In our testing this is usually around 5 minutes.
 */
const TWITCH_STREAM_LIVE_DELAY = 5 * 60 * 1000;

export class TwitchService extends Service implements IPlatformService {
  @Inject() hostsService: HostsService;

  @Inject() settingsService: SettingsService;

  @Inject() userService: UserService;

  authWindowOptions: Electron.BrowserWindowConstructorOptions = {
    width: 600,
    height: 800,
  };

  // Streamlabs Production Twitch OAuth Client ID
  clientId = '8bmp6j83z5w4mepq0dn0q1a7g186azi';

  get authUrl() {
    const host = this.hostsService.streamlabs;
    const query =
      `_=${Date.now()}&skip_splash=true&external=electron&twitch&force_verify&` +
      'scope=channel_read,channel_editor,user:edit:broadcast&origin=slobs';
    return `https://${host}/slobs/login?${query}`;
  }

  get oauthToken() {
    return this.userService.platform.token;
  }

  get twitchId() {
    return this.userService.platform.id;
  }

  getRawHeaders(authorized = false, isNewApi = false) {
    const map: TwitchRequestHeaders = {
      'Client-Id': this.clientId,
      Accept: 'application/vnd.twitchtv.v5+json',
      'Content-Type': 'application/json',
    };

    return authorized ? { ...map, Authorization: `${isNewApi ? 'Bearer' : 'OAuth'} ${this.oauthToken}` } : map;
  }

  getHeaders(authorized = false, isNewApi = false): Headers {
    const headers = new Headers();

    Object.entries(this.getRawHeaders(authorized, isNewApi)).forEach(([key, value]) => {
      headers.append(key, value);
    });

    return headers;
  }

  // TODO: Some of this code could probably eventually be
  // shared with the Youtube platform.
  setupStreamSettings(auth: IPlatformAuth) {
    this.fetchStreamKey().then(key => {
      const settings = this.settingsService.getSettingsFormData('Stream');

      settings.forEach(subCategory => {
        subCategory.parameters.forEach(parameter => {
          if (parameter.name === 'service') {
            parameter.value = 'Twitch';
          }

          if (parameter.name === 'key') {
            parameter.value = key;
          }
        });
      });

      this.settingsService.setSettings('Stream', settings);
    });
  }

  fetchNewToken(): Promise<void> {
    const host = this.hostsService.streamlabs;
    const url = `https://${host}/api/v5/slobs/twitch/refresh`;
    const headers = authorizedHeaders(this.userService.apiToken);
    const request = new Request(url, { headers });

    return fetch(request)
      .then(handleErrors)
      .then(response => response.json())
      .then(response => this.userService.updatePlatformToken(response.access_token));
  }

  @requiresToken()
  fetchRawChannelInfo() {
    const headers = this.getHeaders(true);
    const request = new Request('https://api.twitch.tv/kraken/channel', {
      headers,
    });

    return fetch(request)
      .then(handleErrors)
      .then(response => response.json());
  }

  fetchStreamKey(): Promise<string> {
    return this.fetchRawChannelInfo().then(json => json.stream_key);
  }

  fetchChannelInfo(): Promise<IChannelInfo> {
    return this.fetchRawChannelInfo().then(json => ({
      title: json.status,
      game: json.game,
    }));
  }

  @requiresToken()
  fetchUserInfo() {
    const headers = this.getHeaders();
    const request = new Request(`https://api.twitch.tv/helix/users?id=${this.twitchId}`, {
      headers,
    });

    return fetch(request)
      .then(handleErrors)
      .then(response => response.json())
      .then(json => {
        if (json[0] && json[0].login) {
          return { username: json[0].login };
        }
        return {};
      });
  }

  fetchViewerCount(): Promise<number> {
    const headers = this.getHeaders();
    const request = new Request(`https://api.twitch.tv/kraken/streams/${this.twitchId}`, {
      headers,
    });

    return fetch(request)
      .then(handleErrors)
      .then(response => response.json())
      .then(json => (json.stream ? json.stream.viewers : 0));
  }

  @requiresToken()
  putChannelInfo({ title, game }: IChannelInfo): Promise<boolean> {
    const headers = this.getHeaders(true);
    const data = { channel: { status: title, game } };
    const request = new Request(`https://api.twitch.tv/kraken/channels/${this.twitchId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });

    return fetch(request)
      .then(handleErrors)
      .then(() => true);
  }

  searchGames(searchString: string): Promise<IGame[]> {
    const headers = this.getHeaders();
    const request = new Request(`https://api.twitch.tv/kraken/search/games?query=${searchString}`, {
      headers,
    });

    return fetch(request)
      .then(handleErrors)
      .then(response => response.json())
      .then(json => json.games);
  }

  getChatUrl(mode: string) {
    const nightMode = mode === 'day' ? 'popout' : 'darkpopout';
    return Promise.resolve(
      `https://twitch.tv/popout/${this.userService.platform.username}/chat?${nightMode}`,
    );
  }

  @requiresToken()
  getAllTags() {
    return getAllTags(this.getRawHeaders(true));
  }

  @requiresToken()
  getStreamTags() {
    return getStreamTags(this.twitchId, this.getRawHeaders(true, true));
  }

  searchCommunities(searchString: string) {
    const headers = this.getHeaders();

    const data = {
      requests: [
        {
          indexName: 'community',
          params: `query=${searchString}&page=0&hitsPerPage=50&numericFilters=&facets=*&facetFilters=`,
        },
      ],
    };

    const communitySearchUrl =
      'https://xluo134hor-dsn.algolia.net/1/indexes/*/queries' +
      '?x-algolia-application-id=XLUO134HOR&x-algolia-api-key=d157112f6fc2cab93ce4b01227c80a6d';

    const request = new Request(communitySearchUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    return fetch(request)
      .then(handleErrors)
      .then(response => response.json())
      .then(json => json.results[0].hits);
  }

  getStreams() {
    return getUserStreams(this.twitchId, this.getRawHeaders(true));
  }

  async beforeGoLive() {}

  @requiresToken()
  async afterGoLive(context: StreamingContext) {
    updateTags(this.getRawHeaders(true, true))(context.twitchTags)(this.twitchId);
  }
}
