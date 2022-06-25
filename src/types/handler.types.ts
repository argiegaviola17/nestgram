import { ControllerClass } from './decorators.types';
import { MiddlewareFunction } from './middleware.types';
import {
  IContact,
  IDice,
  ILocation,
  IMessage,
  IMessageEntity,
  IPoll,
  IUpdate,
  IVenue,
} from './update.types';
import { Answer, Media, MessageCreator } from '../classes';
import { IUser } from './chat.types';

export interface IHandler {
  controller: ControllerClass;
  middlewares: MiddlewareFunction[];
  methodKey: string;
}

export type ArgsTypes = [
  IUpdate, // update
  IMessage | undefined, // message
  string | undefined, // message text
  Answer, // answer
  IMessageEntity[] | undefined, // message entities
  string[], // command params
  any, // params
  IUser | undefined, // sender
  number | undefined, // user id
  ILocation, // location
  IContact, // contact
  IVenue, // venue
  IPoll, // poll
  IDice, // dice
];

export type ContentTypes = Media | string | undefined | null;

export type HandlerMethod = ((...args: ArgsTypes) => MessageCreator | ContentTypes) & {
  prototype: { name: 'AsyncFunction' | 'Function' };
};
