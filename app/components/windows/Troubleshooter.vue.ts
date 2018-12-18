import Vue from 'vue';
import moment from 'moment';
import { Component } from 'vue-property-decorator';
import { Inject } from '../../util/injector';
import ModalLayout from '../ModalLayout.vue';
import { TIssueCode } from 'services/troubleshooter';
import {
  INotificationsServiceApi,
  INotification
} from 'services/notifications';
import { ISettingsServiceApi, ISettingsSubCategory } from 'services/settings';
import { WindowsService } from 'services/windows';
import GenericFormGroups from 'components/obs/inputs/GenericFormGroups.vue';
import { TObsFormData } from 'components/obs/inputs/ObsInput';
import { EStreamingState, StreamingService } from '../../services/streaming';

@Component({
  components: { ModalLayout, GenericFormGroups }
})
export default class Troubleshooter extends Vue {
  @Inject() private notificationsService: INotificationsServiceApi;
  @Inject() private settingsService: ISettingsServiceApi;
  @Inject() private windowsService: WindowsService;
  @Inject() streamingService: StreamingService;

  streamingSettings: ISettingsSubCategory[] | null = null;
  outputSettings: ISettingsSubCategory[] | null = null;

  issueCode = this.windowsService.getChildWindowQueryParams()
    .issueCode as TIssueCode;

  mounted() {
    this.getSettings();
  }

  get issue(): INotification {
    return this.notificationsService
      .getAll()
      .find(notify => notify.code === this.issueCode);
  }

  getSettings() {
    if (this.issueCode === 'FRAMES_DROPPED') {
      [this.streamingSettings, this.outputSettings] = getStreamSettings(
        this.settingsService.getSettingsFormData
      );
    }
  }

  showSettings() {
    this.settingsService.showSettings();
  }

  get isStreaming() {
    return this.streamingService.isStreaming;
  }

  saveOutputSettings() {
    this.settingsService.setSettings('Output', this.outputSettings);
  }

  saveStreamingSettings() {
    this.settingsService.setSettings('Stream', this.streamingSettings);
  }

  moment(time: number): string {
    return moment(time).fromNow();
  }
}

const getStreamSettings = (
  getSettingsFn: (categoryName: string) => ISettingsSubCategory[]
) => {
  return [
    getSettingsFn('Stream').map(hideParamsForCategory),
    getSettingsFn('Output').map(hideParamsForCategory)
  ];
};

const paramsToShow = ['server', 'VBitrate', 'ABitrate'];

const hideParamsForCategory = (
  category: ISettingsSubCategory
): ISettingsSubCategory => ({
  ...category,
  parameters: hideParams(category.parameters)
});

const hideParams = (parameters: TObsFormData): TObsFormData => {
  return parameters.map(parameter => ({
    ...parameter,
    visible: paramsToShow.includes(parameter.name)
  }));
};
