import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';

import { Event, User } from '../../shared/models';
import { EventsService, UsersService, EventRegistrationsService } from '../../services';
import { utilities } from '../../shared';

@Component({
    moduleId: module.id,
    selector: 'event-list',
    templateUrl: './event-list.template.html',
    styleUrls: ['./event-list.component.css']
})
export class EventListComponent implements OnInit {
    dateFormat: string = utilities.dateFormat;
    private _userEventsById: any = {};

    constructor(
        private _eventsService: EventsService,
        private _regsService: EventRegistrationsService,
        private _usersService: UsersService
    ) {}

    @Input() events: Event[];
    @Input() hasMore: boolean = true;
    @Output() onEventTap: EventEmitter<any> = new EventEmitter<any>();
    @Output() scrolledToBottom: EventEmitter<any> = new EventEmitter<any>();

    ngOnInit() {
        this._usersService.currentUser()
            .then(user => this._eventsService.getUserEvents(user.Id))
            .then(userEvents => {
                userEvents.forEach(ev => {
                    this._userEventsById[ev.Id] = true;
                });
            });
    }

    eventTap(event: Event) {
        this.onEventTap.emit(event);
    }

    userIsRegistered(eventId: string) {
        return this._userEventsById && this._userEventsById[eventId];
    }

    isPastEvent(event: Event) {
        return this._eventsService.isPastEvent(event);
    }

    getLabelText(event: Event) {
        let text: string;
        if (this._eventsService.isPastEvent(event)) {
            text = 'You went';
        } else {
            text = event.EventDate ? 'Going' : 'Voted';
        }
        return text;
    }

    getEventDate(event: Event) {
        let date: Date = null;

        if (event.EventDate) {
            date = new Date(event.EventDate);
        }

        return date;
    }

    getRemainingTime(event: Event) {
        let eventDate = this.getEventDate(event);

        if (!eventDate) {
            return 'DATE: OPEN FOR VOTING';
        }

        return utilities.getRelativeTimeText(eventDate);
    }

    onLoadMore() {
        this.scrolledToBottom.emit();
    }

    hasLoaderForMore() {
        return this.scrolledToBottom.observers.length > 0;
    }
}
