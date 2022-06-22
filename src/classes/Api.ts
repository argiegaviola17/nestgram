import {
  Alert,
  Audio,
  ContentTypes,
  Document,
  IAnswerCallbackQueryFetchOptions,
  IAnswerCallbackQueryOptions,
  ICopyMessageFetchOptions,
  ICopyMessageOptions,
  IDefaultSendMediaConfig,
  IDeleteWebhookConfig,
  IFile,
  IForwardMessageFetchOptions,
  IForwardMessageOptions,
  IGetFileFetchOptions,
  IMessage,
  IMessageId,
  InputMediaTypes,
  InputSupportedMedia,
  IOptions,
  ISendAnimationFetchOptions,
  ISendAnimationOptions,
  ISendAudioFetchOptions,
  ISendAudioOptions,
  ISendDocumentFetchOptions,
  ISendDocumentOptions,
  ISendFetchOptions,
  ISendLocationFetchOptions,
  ISendLocationOptions,
  ISendMediaGroupFetchOptions,
  ISendMediaGroupOptions,
  ISendOptions,
  ISendPhotoFetchOptions,
  ISendPhotoOptions,
  ISendVideoFetchOptions,
  ISendVideoNoteFetchOptions,
  ISendVideoNoteOptions,
  ISendVideoOptions,
  ISendVoiceFetchOptions,
  ISendVoiceOptions,
  IUser,
  IWebhookConfig,
  Keyboard,
  MediaFileTypes,
  MediaGroup,
  MessageCreator,
  MessageSend,
  Photo,
  Toast,
  Video,
  Voice,
  Location,
} from '..';

import { mediaCache } from './Media/MediaCache';
import { Animation, Media, VideoNote } from './Media';
import { error } from '../logger';

import axios from 'axios';
import * as FormData from 'form-data';
import * as fs from 'fs';

export class Api {
  constructor(private readonly token?: string) {}

  async call<T = any, K = any>(
    token: string,
    method: string,
    config?: K,
    headers?: any,
  ): Promise<T> {
    try {
      const { data } = await axios.post(`https://api.telegram.org/bot${token}/${method}`, config, {
        headers,
        maxBodyLength: Infinity,
      });

      return data.result;
    } catch (e: any) {
      throw error(`.callApi error: ${e.response?.data?.description || e}`);
    }
  }

  public callApi<T = any, K = any>(method: string, config?: K): Promise<T> {
    if (!this.token) throw error(`You can't call .${method} without token`);
    return this.call<T, K>(this.token, method, config);
  }

  private static appendMediaToFormData(formData: FormData, key: string, media: string | Media) {
    if (typeof media === 'string') {
      formData.append(key, media);
    } else if (media.passType === 'path') {
      formData.append(key, fs.createReadStream(media.media));
    } else {
      formData.append(key, media.media);
    }
  }

  private buildFormData<K extends IDefaultSendMediaConfig>(
    fromMediaKey: string,
    media: Media,
    config: K,
  ): FormData {
    const formData: FormData = new FormData();

    Api.appendMediaToFormData(
      formData,
      fromMediaKey,
      mediaCache.getMediaFileId(media.media) || media,
    );

    if (config.thumb) {
      Api.appendMediaToFormData(
        formData,
        'thumb',
        mediaCache.getMediaFileId(config.thumb.media) || config.thumb,
      );
    }

    Object.keys(config).forEach((key: string): void => {
      const data: K[keyof K] = config[key as keyof typeof config];
      if (!data) return;
      formData.append(key, typeof data === 'object' ? JSON.stringify(data) : data);
    });

    return formData;
  }

  private buildAttachFormData<K>(config: K): FormData {
    const formData: FormData = new FormData();

    Object.keys(config).forEach((key: string): void => {
      const data: K[keyof K] = config[key as keyof typeof config];
      if (!data) return;
      formData.append(key, typeof data === 'object' ? JSON.stringify(data) : data);
    });

    return formData;
  }

  private static saveMediaFileId(
    path: string,
    mediaKey: MediaFileTypes,
    message: IMessage,
  ): IMessage {
    if (!mediaCache.getMediaFileId(path)) {
      let mediaFileInfo: any & { file_id: string } = message[mediaKey];
      if (mediaKey === 'photo') mediaFileInfo = message[mediaKey][message[mediaKey].length - 1];
      mediaCache.saveMediaFileId(path, mediaFileInfo.file_id);
    }

    return message;
  }

  /**
   * Returns info about the bot
   * */
  getMe(): Promise<IUser> {
    return this.callApi<IUser>('getMe');
  }

  /**
   * Set ups a webhook
   * @param config Webhook config
   * */
  setWebhook(config: IWebhookConfig): Promise<boolean> {
    return this.callApi<boolean, IWebhookConfig>('setWebhook', config);
  }

  /**
   * Deletes a webhook
   * @param config Delete webhook config
   * */
  deleteWebhook(config?: IDeleteWebhookConfig): Promise<boolean> {
    return this.callApi<boolean, IDeleteWebhookConfig>('deleteWebhook', config);
  }

  /**
   * Sends a message to the chat
   * @param chatId Chat ID where you want to send message. It can be id of group/channel or ID of user
   * @param content Message data that you want to send, some media (e.g. Photo/Message class) or string for text message
   * @param keyboard Pass Keyboard class if you want to add keyboard to the message
   * @param moreOptions More options {@link ISendOptions}
   * @see https://core.telegram.org/bots/api#sendmessage
   * */
  send(
    chatId: string | number,
    content: MessageCreator | ContentTypes,
    keyboard: Keyboard | null = null,
    moreOptions: IOptions = {},
  ): Promise<IMessage | IMessage[]> {
    if (content instanceof MessageCreator) {
      moreOptions = { ...moreOptions, ...content.options };

      if (content instanceof MessageSend) {
        content = content.content;
      } else if (content instanceof Alert || content instanceof Toast) {
        content = content.text;
      } else if (content instanceof Location) {
        return this.sendLocation(chatId, content.latitude, content.longitude, moreOptions);
      }
    }

    if (content instanceof Media) {
      if (content instanceof Photo) return this.sendPhoto(chatId, content, keyboard, moreOptions);
      else if (content instanceof Animation)
        return this.sendAnimation(chatId, content, keyboard, moreOptions);
      else if (content instanceof Video)
        return this.sendVideo(chatId, content, keyboard, moreOptions);
      else if (content instanceof VideoNote)
        return this.sendVideoNote(chatId, content, keyboard, moreOptions);
      else if (content instanceof Audio)
        return this.sendAudio(chatId, content, keyboard, moreOptions);
      else if (content instanceof Document)
        return this.sendDocument(chatId, content, keyboard, moreOptions);
      else if (content instanceof Voice)
        return this.sendVoice(chatId, content, keyboard, moreOptions);
      else if (content instanceof MediaGroup)
        return this.sendMediaGroup(chatId, content.mediaGroup, moreOptions);
      else
        throw error(
          "Media file type is not defined. Don't use Media class, use Photo, Video class instead",
        );
    }

    if (keyboard) moreOptions.reply_markup = keyboard.buildMarkup();
    if (!(typeof content === 'string')) return;

    return this.callApi<IMessage, ISendFetchOptions>('sendMessage', {
      text: content,
      chat_id: chatId,
      parse_mode: 'HTML',
      ...moreOptions,
    });
  }

  /**
   * Sends a photo to the chat
   * @param chatId Chat ID where you want to send message. It can be id of group/channel or ID of user
   * @param photo Photo that you want to send (you can create it using Photo class {@link Photo})
   * @param keyboard Pass Keyboard class if you want to add keyboard to the message
   * @param moreOptions More options {@link ISendPhotoOptions}
   * @see https://core.telegram.org/bots/api#sendphoto
   * */
  async sendPhoto(
    chatId: string | number,
    photo: Photo,
    keyboard: Keyboard | null = null,
    moreOptions: ISendPhotoOptions = {},
  ): Promise<IMessage> {
    if (keyboard) moreOptions.reply_markup = keyboard.buildMarkup();

    return Api.saveMediaFileId(
      photo.media,
      'photo',
      await this.callApi<IMessage, FormData>(
        'sendPhoto',
        this.buildFormData<ISendPhotoFetchOptions>('photo', photo, {
          chat_id: chatId,
          parse_mode: 'HTML',
          ...moreOptions,
        }),
      ),
    );
  }

  /**
   * Sends a video to the chat
   * @param chatId Chat ID where you want to send message. It can be id of group/channel or ID of user
   * @param video Video that you want to send (you can create it using Video class {@link Video})
   * @param keyboard Pass Keyboard class if you want to add keyboard to the message
   * @param moreOptions More options {@link ISendVideoOptions}
   * @see https://core.telegram.org/bots/api#sendvideo
   * */
  async sendVideo(
    chatId: string | number,
    video: Video,
    keyboard: Keyboard | null = null,
    moreOptions: ISendVideoOptions = {},
  ): Promise<IMessage> {
    if (keyboard) moreOptions.reply_markup = keyboard.buildMarkup();

    return Api.saveMediaFileId(
      video.media,
      'video',
      await this.callApi<IMessage, FormData>(
        'sendVideo',
        this.buildFormData<ISendVideoFetchOptions>('video', video, {
          chat_id: chatId,
          parse_mode: 'HTML',
          thumb: video.thumb,
          ...video.resolution,
          ...moreOptions,
        }),
      ),
    );
  }

  /**
   * Sends a video note to the chat
   * @param chatId Chat ID where you want to send message. It can be id of group/channel or ID of user
   * @param videoNote Video note that you want to send (you can create it using Video class {@link VideoNote})
   * @param keyboard Pass Keyboard class if you want to add keyboard to the message
   * @param moreOptions More options {@link ISendVideoNoteOptions}
   * @see https://core.telegram.org/bots/api#sendvideonote
   * */
  async sendVideoNote(
    chatId: string | number,
    videoNote: VideoNote,
    keyboard: Keyboard | null = null,
    moreOptions: ISendVideoNoteOptions = {},
  ): Promise<IMessage> {
    if (keyboard) moreOptions.reply_markup = keyboard.buildMarkup();

    return Api.saveMediaFileId(
      videoNote.media,
      'video_note',
      await this.callApi<IMessage, FormData>(
        'sendVideoNote',
        this.buildFormData<ISendVideoNoteFetchOptions>('video_note', videoNote, {
          chat_id: chatId,
          parse_mode: 'HTML',
          thumb: videoNote.thumb,
          ...moreOptions,
        }),
      ),
    );
  }

  /**
   * Sends an audio to the chat
   * @param chatId Chat ID where you want to send message. It can be id of group/channel or ID of user
   * @param audio Audio that you want to send (you can create it using Audio class {@link Audio})
   * @param keyboard Pass Keyboard class if you want to add keyboard to the message
   * @param moreOptions More options {@link ISendAudioOptions}
   * @see https://core.telegram.org/bots/api#sendaudio
   * */
  async sendAudio(
    chatId: string | number,
    audio: Audio,
    keyboard: Keyboard | null = null,
    moreOptions: ISendAudioOptions = {},
  ): Promise<IMessage> {
    if (keyboard) moreOptions.reply_markup = keyboard.buildMarkup();

    return Api.saveMediaFileId(
      audio.media,
      'audio',
      await this.callApi<IMessage, FormData>(
        'sendAudio',
        this.buildFormData<ISendAudioFetchOptions>('audio', audio, {
          chat_id: chatId,
          parse_mode: 'HTML',
          thumb: audio.thumb,
          ...moreOptions,
        }),
      ),
    );
  }

  /**
   * Sends a voice message to the chat
   * @param chatId Chat ID where you want to send message. It can be id of group/channel or ID of user
   * @param voice Voice that you want to send (you can create it using Audio class {@link Voice})
   * @param keyboard Pass Keyboard class if you want to add keyboard to the message
   * @param moreOptions More options {@link ISendVoiceOptions}
   * @see https://core.telegram.org/bots/api#sendaudio
   * */
  async sendVoice(
    chatId: string | number,
    voice: Voice,
    keyboard: Keyboard | null = null,
    moreOptions: ISendVoiceOptions = {},
  ): Promise<IMessage> {
    if (keyboard) moreOptions.reply_markup = keyboard.buildMarkup();

    return Api.saveMediaFileId(
      voice.media,
      'voice',
      await this.callApi<IMessage, FormData>(
        'sendVoice',
        this.buildFormData<ISendVoiceFetchOptions>('voice', voice, {
          chat_id: chatId,
          parse_mode: 'HTML',
          ...moreOptions,
        }),
      ),
    );
  }

  /**
   * Sends a document to the chat
   * @param chatId Chat ID where you want to send message. It can be id of group/channel or ID of user
   * @param document Document that you want to send (you can create it using {@link Document}) class
   * @param keyboard Pass Keyboard class if you want to add keyboard to the message
   * @param moreOptions More options {@link ISendDocumentOptions}
   * @see https://core.telegram.org/bots/api#senddocument
   * */
  async sendDocument(
    chatId: string | number,
    document: Document,
    keyboard: Keyboard | null = null,
    moreOptions: ISendDocumentOptions = {},
  ): Promise<IMessage> {
    if (keyboard) moreOptions.reply_markup = keyboard.buildMarkup();

    return Api.saveMediaFileId(
      document.media,
      'document',
      await this.callApi<IMessage, FormData>(
        'sendDocument',
        this.buildFormData<ISendDocumentFetchOptions>('document', document, {
          chat_id: chatId,
          parse_mode: 'HTML',
          thumb: document.thumb,
          ...moreOptions,
        }),
      ),
    );
  }

  /**
   * Sends an animation to the chat
   * @param chatId Chat ID where you want to send message. It can be id of group/channel or ID of user
   * @param animation Animation that you want to send (you can create it using {@link Animation}) class
   * @param keyboard Pass Keyboard class if you want to add keyboard to the message
   * @param moreOptions More options {@link ISendAnimationOptions}
   * @see https://core.telegram.org/bots/api#sendanimation
   * */
  async sendAnimation(
    chatId: string | number,
    animation: Animation,
    keyboard: Keyboard | null = null,
    moreOptions: ISendAnimationOptions = {},
  ): Promise<IMessage> {
    if (keyboard) moreOptions.reply_markup = keyboard.buildMarkup();

    return Api.saveMediaFileId(
      animation.media,
      'animation',
      await this.callApi<IMessage, FormData>(
        'sendAnimation',
        this.buildFormData<ISendAnimationFetchOptions>('animation', animation, {
          chat_id: chatId,
          parse_mode: 'HTML',
          thumb: animation.thumb,
          ...animation.resolution,
          ...moreOptions,
        }),
      ),
    );
  }

  /**
   * Sends a media group to the chat
   * @param chatId Chat ID where you want to send message. It can be id of group/channel or ID of user
   * @param mediaGroup Media group that you want to send (you can create it using {@link MediaGroup}) class
   * @param moreOptions More options {@link ISendMediaGroupOptions}
   * @see https://core.telegram.org/bots/api#sendmediagroup
   * */
  async sendMediaGroup(
    chatId: string | number,
    mediaGroup: InputSupportedMedia[],
    moreOptions: ISendMediaGroupOptions = {},
  ): Promise<IMessage[]> {
    const formData: FormData = this.buildAttachFormData<ISendMediaGroupFetchOptions>({
      chat_id: chatId,
      media: mediaGroup.map((media: InputSupportedMedia, index: number): InputMediaTypes => {
        return {
          type: media.type,
          media: mediaCache.getMediaFileId(media.media) || `attach://${index}`,
          ...(media.thumb
            ? { thumb: mediaCache.getMediaFileId(media.thumb.media) || `attach://${index}_thumb` }
            : {}),
          ...(media instanceof Video ? media.resolution : {}),
          ...(media.options || {}),
        };
      }),
      ...moreOptions,
    });

    mediaGroup.forEach((media: InputSupportedMedia, index: number): void => {
      if (!mediaCache.getMediaFileId(media.media))
        Api.appendMediaToFormData(formData, index.toString(), media);

      if (media.thumb) {
        if (!mediaCache.getMediaFileId(media.thumb.media))
          Api.appendMediaToFormData(formData, `${index.toString()}_thumb`, media.thumb);
      }
    });

    const sentMessages: IMessage[] = await this.callApi<IMessage[], FormData>(
      'sendMediaGroup',
      formData,
    );

    for (const sentMessage of sentMessages) {
      const media: Media = mediaGroup[sentMessages.indexOf(sentMessage)];
      Api.saveMediaFileId(media.media, media.type, sentMessage);
    }

    return sentMessages;
  }

  /**
   * Sends a location to the chat
   * @param chatId Chat ID where you want to send message. It can be id of group/channel or ID of user
   * @param latitude Latitude of the location
   * @param longitude Longitude of the location
   * @param moreOptions Message options {@link ISendLocationOptions}
   * @see https://core.telegram.org/bots/api#sendlocation
   * */
  sendLocation(
    chatId: number | string,
    latitude: number,
    longitude: number,
    moreOptions: ISendLocationOptions = {},
  ): Promise<IMessage> {
    return this.callApi<IMessage, ISendLocationFetchOptions>('sendLocation', {
      chat_id: chatId,
      latitude,
      longitude,
      ...moreOptions,
    });
  }

  /**
   * Answers to the callback query (inline button click)
   * @param callback_query_id Callback query id
   * @param moreOptions More options {@link IAnswerCallbackQueryOptions}
   * @see https://core.telegram.org/bots/api#answercallbackquery
   * */
  answerCallbackQuery(
    callback_query_id: string,
    moreOptions: IAnswerCallbackQueryOptions = {},
  ): Promise<boolean> {
    return this.callApi<boolean, IAnswerCallbackQueryFetchOptions>('answerCallbackQuery', {
      callback_query_id,
      ...moreOptions,
    });
  }

  /**
   * Alert
   * @param callback_query_id Callback query id
   * @param text Alert text
   * @param moreOptions More options {@link IAnswerCallbackQueryOptions}
   * @see https://core.telegram.org/bots/api#answercallbackquery
   * */
  alert(
    callback_query_id: string,
    text: string,
    moreOptions: IAnswerCallbackQueryOptions = {},
  ): Promise<boolean> {
    return this.answerCallbackQuery(callback_query_id, { text, show_alert: true });
  }

  /**
   * Toast
   * @param callback_query_id Callback query id
   * @param text Toast text
   * @param moreOptions More options {@link IAnswerCallbackQueryOptions}
   * @see https://core.telegram.org/bots/api#answercallbackquery
   * */
  toast(
    callback_query_id: string,
    text: string,
    moreOptions: IAnswerCallbackQueryOptions = {},
  ): Promise<boolean> {
    return this.answerCallbackQuery(callback_query_id, { text, show_alert: false });
  }

  /**
   * Returns info about the file
   * @param fileId File id that you want to get
   * @return {@link IFile}
   * */
  getFile(fileId: string): Promise<IFile> {
    return this.callApi<IFile, IGetFileFetchOptions>('getFile', { file_id: fileId });
  }

  /**
   * Forwards a message
   * @param msgId Id of the message you want to forward
   * @param fromChatId Chat id from you want to forward a message
   * @param toChatId Chat id you want to forward to
   * @param moreOptions More options {@link IForwardMessageOptions}
   * @see https://core.telegram.org/bots/api#forwardmessage
   * */
  forward(
    msgId: number,
    fromChatId: number | string,
    toChatId: number | string,
    moreOptions: IForwardMessageOptions = {},
  ): Promise<IMessage> {
    return this.callApi<IMessage, IForwardMessageFetchOptions>('forwardMessage', {
      chat_id: toChatId,
      from_chat_id: fromChatId,
      message_id: msgId,
      ...moreOptions,
    });
  }

  /**
   * Copies a message
   * @param msgId Id of the message you want to copy
   * @param fromChatId Chat id from you want to copy a message
   * @param toChatId Chat id you want to copy to
   * @param keyboard Pass Keyboard class if you want to add keyboard to the message
   * @param moreOptions More options {@link ICopyMessageOptions}
   * @see https://core.telegram.org/bots/api#copymessage
   * */
  copy(
    msgId: number,
    fromChatId: number | string,
    toChatId: number | string,
    keyboard: Keyboard | null = null,
    moreOptions: ICopyMessageOptions = {},
  ): Promise<IMessageId> {
    if (keyboard) moreOptions.reply_markup = keyboard.buildMarkup();

    return this.callApi<IMessageId, ICopyMessageFetchOptions>('copyMessage', {
      message_id: msgId,
      from_chat_id: fromChatId,
      chat_id: toChatId,
      ...moreOptions,
    });
  }
}
