import { RawConnection } from '@igloo15/mqtt-browser-lib';

export class MqttGameConnection {
    private _conn: RawConnection;

    constructor(host: string, port: number) {
        this._conn = new RawConnection(host, port, 'myApp');
    }
}