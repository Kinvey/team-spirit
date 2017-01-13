import { Component, OnInit } from '@angular/core';
import { RouterExtensions } from 'nativescript-angular/router';
import { Page } from 'ui/page';

import { EventsService, UsersService, GroupsService } from '../../services';
import { Event } from '../../shared/models';
import { utilities } from '../../shared';

@Component({
    selector: 'events',
    templateUrl: 'events/events/events.template.html',
    styleUrls: ['events/events/events.component.css']
})
export class EventsComponent implements OnInit {
    upcomingEvents: Promise<Event[]>;
    pastEvents: Promise<Event[]>;
    initialized: boolean;
    dateFormat: string = utilities.dateFormat;
    canAdd: boolean = false;

    constructor(
        private _usersService: UsersService,
        private _eventsService: EventsService,
        private _groupsService: GroupsService,
        private _routerExtensions: RouterExtensions,
        private _page: Page
    ) { }

    onAdd() {
        this._routerExtensions.navigate(['/events/add']);
    }

    ngOnInit() {
        this._page.actionBarHidden = false;
        this.upcomingEvents = this._eventsService.getUpcoming();

        this.pastEvents = this._usersService.currentUser()
            .then(user => {
                this.canAdd = !!user;
                return this._groupsService.getUserGroups(user.Id);
            })
            .then(userGroups => {
                return this._eventsService.getPast(userGroups.map(g => g.Id));
            });

        Promise.all([this.upcomingEvents, this.pastEvents])
            .then(() => this.initialized = true, () => this.initialized = false);
    }

    showDetails(event: Event) {
        this._routerExtensions.navigate([`/events/${event.Id}`]);
    }
}
