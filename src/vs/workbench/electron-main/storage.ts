/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


'use strict';

import path = require('path');
import fs = require('fs');
import events = require('events');
import env = require('vs/workbench/electron-main/env');
import {ServiceIdentifier, createDecorator} from 'vs/platform/instantiation/common/instantiation';

const EventTypes = {
	STORE: 'store'
};

export const IStorageService = createDecorator<IStorageService>('storageService');

export interface IStorageService {
	serviceId: ServiceIdentifier<any>;
	onStore<T>(clb: (key: string, oldValue: T, newValue: T) => void): () => void;
	getItem<T>(key: string, defaultValue?: T): T;
	setItem(key: string, data: any): void;
	removeItem(key: string): void;
}

export class StorageService implements IStorageService {

	serviceId = IStorageService;

	private dbPath: string;
	private database: any = null;
	private eventEmitter = new events.EventEmitter();

	constructor(@env.IEnvironmentService private envService: env.IEnvironmentService) {
		this.dbPath = path.join(envService.appHome, 'storage.json');
	}

	onStore<T>(clb: (key: string, oldValue: T, newValue: T) => void): () => void {
		this.eventEmitter.addListener(EventTypes.STORE, clb);

		return () => this.eventEmitter.removeListener(EventTypes.STORE, clb);
	}

	getItem<T>(key: string, defaultValue?: T): T {
		if (!this.database) {
			this.database = this.load();
		}

		const res = this.database[key];
		if (typeof res === 'undefined') {
			return defaultValue;
		}

		return this.database[key];
	}

	setItem(key: string, data: any): void {
		if (!this.database) {
			this.database = this.load();
		}

		// Shortcut for primitives that did not change
		if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
			if (this.database[key] === data) {
				return;
			}
		}

		let oldValue = this.database[key];
		this.database[key] = data;
		this.save();

		this.eventEmitter.emit(EventTypes.STORE, key, oldValue, data);
	}

	removeItem(key: string): void {
		if (!this.database) {
			this.database = this.load();
		}

		if (this.database[key]) {
			let oldValue = this.database[key];
			delete this.database[key];
			this.save();

			this.eventEmitter.emit(EventTypes.STORE, key, oldValue, null);
		}
	}

	private load(): any {
		try {
			return JSON.parse(fs.readFileSync(this.dbPath).toString());
		} catch (error) {
			if (this.envService.cliArgs.verboseLogging) {
				console.error(error);
			}

			return {};
		}
	}

	private save(): void {
		fs.writeFileSync(this.dbPath, JSON.stringify(this.database, null, 4));
	}
}
