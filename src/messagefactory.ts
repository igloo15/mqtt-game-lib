import { customAlphabet, urlAlphabet } from 'nanoid';
import { RequestMessage, ResponseMessage, ClientPing, ResponseWaiter, RequestAllMessage } from './types';

const nanoid = customAlphabet(urlAlphabet, 10);

export class MessageFactory {
    private _id: string;
    private _gameName: string;
    private _gameId: string;

    constructor(id: string, gameName: string, gameId: string) {
        this._id = id;
        this._gameName = gameName;
        this._gameId = gameId;
    }

    generateId(): string {
        return nanoid();
    }

    public createRequest(message: any, type: string, receiverId: string): RequestMessage {
        return {
            id: nanoid(),
            senderId: this._id,
            receiverId: receiverId,
            type,
            message
        };
    }

    public createAllRequest(message: any, type: string): RequestAllMessage {
        return {
            id: nanoid(),
            senderId: this._id,
            type,
            message
        };
    }

    public createResponse(msgId: string): ResponseMessage {
        return {
            msgId,
            receiverId: this._id
        };
    }

    public createWaiter(receivers: string[], finish: () => void, allResponse: boolean): ResponseWaiter {
        return {
            requestTime: this.getTime(),
            receivers,
            responses: [],
            allResponse,
            finish
        };
    }

    public createPing(status: string): ClientPing {
        return {
            id: this._id,
            lastUpdate: this.getTime(),
            status
        };
    }

    public getRequestTopic(id: string) {
        return `mqtt/game/${this._gameName}/${this._gameId}/request/${id}`;
    }

    private getTime() {
        return Date.now();
    }
}