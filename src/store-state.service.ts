import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

import { deepCompare } from './utils';
import { StoreConfigService } from './store-config.service';
import { ScopePath } from './interfaces';

declare const Immutable: any;

/**
 * Store data, apply changes by decorated actions and get data in an Observable or as an instant value.
 */
@Injectable()
export class StoreStateService {

  private state$: BehaviorSubject<any>;
  private states = {};

  constructor(private config: StoreConfigService) {
    console.log('=== Store State Initialization ===');
    console.log('Debug:', this.config.isDebug());
    console.log('Cache:', this.config.isCache());
//    this.log('Store initialState', this.initialState);
//    this.log('Store config', {
//      debug: this.config.isDebug(),
//      cache: this.config.isCache(),
//    });
//     crate state subject
//    this.state$ = new BehaviorSubject<any>(Immutable.fromJS(this.initialState));
//     log state updating
//    this.state$.subscribe(state => {
//      this.log('============== STATE UPDATED ==============');
//      this.log('state', state.toJS());
//    });
  }

  register = (scopePath: ScopePath, initialState: any) => {
    const scope = scopePath.join('/');
    if (!this.states[scope]) {
      if (this.config.isDebug()) {
        console.log('=== Store Registration ===');
        console.log('Scope:', scopePath);
        console.log('InitialState', initialState);
      }
      this.states[scope] = new BehaviorSubject<any>(Immutable.fromJS(initialState));
      this.states[scope].subscribe(state => {
        this.log(`=== State Updated [${scope}] ===`);
        this.log('State', state.toJS());
      });
    }
  };

  /**
   * Get Observable by selector.
   *
   * @param scopePath ScopePath
   * @param mapper
   * @returns {Observable<T>}
   */
  stream = (scopePath: ScopePath, mapper): any => {
    const scope = scopePath.join('/');
    if (!this.states[scope]) {
      throw new Error(`Scope "${scope}" not found!`);
    }
    let state$ = this.states[scope];
    return state$
        .do(state => this.log(`○ Stream side effect`, mapper))
        .map(mapper.mapper)
        .filter(x => typeof x !== 'undefined')
        .distinctUntilChanged(deepCompare)
        .do(state => this.log(`► After distinct side effect`, state))
        .publishReplay(1)
        .refCount();
  };

  /**
   * Get value by selector.
   *
   * @param scopePath ScopePath
   * @param mapper
   * @returns {Array|any}
   */
  value = (scopePath: ScopePath, mapper): any => {
    const scope = scopePath.join('/');
    if (!this.states[scope]) {
      throw new Error(`Scope "${scope}" not found!`);
    }
    let state$ = this.states[scope];
    return mapper.mapper(state$.value);
  };

  /**
   * Dispatch action to store.
   *
   * @param scopePath ScopePath
   * @param reducer
   */
  dispatch = (scopePath: ScopePath, reducer) => {
    const scope = scopePath.join('/');
    if (!this.states[scope]) {
      throw new Error(`Scope "${scope}" not found!`);
    }
    let state$ = this.states[scope];
    this.log(`=== DISPATCHING [${scope}] ===`);
    if (Array.isArray(reducer)) {
      console.log('Multi-dispatch');
      let state = state$.value;
      reducer.forEach((step, index) => {
        console.log('Dispatch step', index, step);
        if (typeof step.reducer === 'function') {
          state = step.reducer(state);
        }
        else {
          throw new Error('Reducer should be a function');
        }
      });
      state$.next(state);
    }
    else {
      this.log('Dispatch', reducer);
      if (typeof reducer.reducer === 'function') {
        state$.next(reducer.reducer(state$.value));
      }
      else {
        throw new Error('Reducer should be a function');
      }
    }
  };

  /**
   * Log some info to console if logging is enabled.
   *
   * @param message
   * @param params
   */
  private log(message, ...params) {
    if (this.config.isDebug()) {
      console.log(message, ...params);
    }
  }

}