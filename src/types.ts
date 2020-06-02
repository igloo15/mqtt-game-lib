export interface ClientPing {
    id: string;
    lastUpdate: number;
    status: string;
}

export interface RequestAllMessage {
    id: string;
    senderId: string;
    message: any;
    type: string;
}

export interface RequestMessage extends RequestAllMessage {
    receiverId: string;
}

export interface ResponseMessage {
    receiverId: string;
    msgId: string;
}

export interface ResponseWaiter {
    requestTime: number;
    allResponse: boolean;
    receivers: string[];
    responses: string[];
    finish: () => void;
}