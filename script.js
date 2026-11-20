"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const storageKeys = {
        events: "campusconnect.events",
        registrations: "campusconnect.registrations",
        hiddenEvents: "campusconnect.hiddenEvents",
        posts: "campusconnect.posts",
        accounts: "campusconnect.accounts",
        session: "campusconnect.session",
        contactMessages: "campusconnect.contactMessages"
    };

    const eventContainer = document.querySelector(".events-container");
    const registrationForm = document.querySelector("#registration-form");
    const eventSelection = document.querySelector("#event-selection");
    const registrationsContainer = document.querySelector("#registrations-container");
    const manageEventsContainer = document.querySelector("#manage-events-container");
    const studentRegistrationsContainer = document.querySelector("#student-registrations-container");
    const themeToggle = document.querySelector(".theme-toggle");
    const eventSearch = document.querySelector("#event-search");
    const clearEventSearch = document.querySelector("#clear-event-search");
    const eventSort = document.querySelector("#event-sort");
    const postComposer = document.querySelector("#post-composer");
    const postContent = document.querySelector("#post-content");
    const postCategory = document.querySelector("#post-category");
    const communityPosts = document.querySelector("#community-posts");
    const postCharacterCount = document.querySelector("#post-character-count");
    const eventForm = document.querySelector("#add-event-form");
    const eventFormSubmit = document.querySelector("#event-form-submit");
    const cancelEventEdit = document.querySelector("#cancel-event-edit");
    const contactMessagesContainer = document.querySelector("#contact-messages");
    const toast = document.createElement("div");
    let activeCategory = "all";
    let activePostFilter = "all";
    let editingEventId = null;
    let toastTimer;

    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.hidden = true;
    document.body.append(toast);

    function showToast(message, kind = "success") {
        window.clearTimeout(toastTimer);
        toast.textContent = message;
        toast.dataset.kind = kind;
        toast.hidden = false;
        toastTimer = window.setTimeout(() => {
            toast.hidden = true;
        }, 3600);
    }

    function readStorage(key, fallback) {
        try {
            const value = localStorage.getItem(key);
            return value === null ? fallback : JSON.parse(value);
        } catch (error) {
            console.error(`Unable to read CampusConnect data (${key}).`, error);
            showToast("Saved data could not be loaded. Your browser storage may be unavailable.", "error");
            return fallback;
        }
    }

    function writeStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Unable to save CampusConnect data (${key}).`, error);
            showToast("Your changes could not be saved in this browser.", "error");
            return false;
        }
    }

    function setTheme(theme, persist = false) {
        const isDark = theme === "dark";
        document.documentElement.dataset.theme = isDark ? "dark" : "light";
        themeToggle.setAttribute("aria-pressed", String(isDark));
        themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
        themeToggle.querySelector("i").className = `fas fa-${isDark ? "moon" : "sun"}`;
        themeToggle.querySelector("span").textContent = isDark ? "Light mode" : "Dark mode";
        document.documentElement.dataset.themeReady = "true";
        if (persist) writeStorage("campusconnect.theme", isDark ? "dark" : "light");
    }

    const savedTheme = readStorage("campusconnect.theme", document.documentElement.dataset.theme);
    setTheme(savedTheme === "dark" ? "dark" : "light");
    themeToggle.addEventListener("click", () => {
        const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        setTheme(nextTheme, true);
    });

    function makeElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    const storedAccounts = readStorage(storageKeys.accounts, []);
    const accounts = Array.isArray(storedAccounts)
        ? storedAccounts.filter((account) =>
            account &&
            typeof account.id === "string" &&
            typeof account.name === "string" &&
            typeof account.email === "string" &&
            typeof account.passwordSalt === "string" &&
            typeof account.passwordHash === "string"
        )
        : [];
    const loginLink = document.querySelector(".login-btn");
    const signupLink = document.querySelector(".signup-btn");
    const accountStatus = document.querySelector("#account-status");
    const accountName = document.querySelector("#account-name");
    const logoutButton = document.querySelector("#logout-button");

    function updateAccountUI(user) {
        loginLink.hidden = Boolean(user);
        signupLink.hidden = Boolean(user);
        accountStatus.hidden = !user;
        logoutButton.hidden = !user;
        accountName.textContent = user ? user.name : "";
    }

    function hexToBytes(value) {
        const bytes = new Uint8Array(value.length / 2);
        for (let index = 0; index < bytes.length; index += 1) {
            bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
        }
        return bytes;
    }

    async function derivePasswordHash(password, salt) {
        if (!window.crypto || !window.crypto.subtle) {
            throw new Error("Secure browser cryptography is unavailable.");
        }
        const passwordKey = await window.crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(password),
            "PBKDF2",
            false,
            ["deriveBits"]
        );
        const hash = await window.crypto.subtle.deriveBits({
            name: "PBKDF2",
            salt: hexToBytes(salt),
            iterations: 310000,
            hash: "SHA-256"
        }, passwordKey, 256);
        return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
    }

    function passwordsMatch(first, second) {
        if (first.length !== second.length) return false;
        let difference = 0;
        for (let index = 0; index < first.length; index += 1) {
            difference |= first.charCodeAt(index) ^ second.charCodeAt(index);
        }
        return difference === 0;
    }

    const savedSession = readStorage(storageKeys.session, null);
    const activeUser = savedSession && typeof savedSession.userId === "string"
        ? accounts.find((account) => account.id === savedSession.userId)
        : null;
    updateAccountUI(activeUser || null);

    const storedContactMessages = readStorage(storageKeys.contactMessages, []);
    const contactMessages = Array.isArray(storedContactMessages)
        ? storedContactMessages.filter((message) =>
            message &&
            typeof message.id === "string" &&
            typeof message.name === "string" &&
            typeof message.subject === "string" &&
            typeof message.message === "string"
        )
        : [];

    function saveContactMessages() {
        return writeStorage(storageKeys.contactMessages, contactMessages);
    }

    function renderContactMessages() {
        if (contactMessages.length === 0) {
            contactMessagesContainer.replaceChildren(
                makeElement("p", "local-message-empty", "No messages saved on this device yet.")
            );
            return;
        }

        const fragment = document.createDocumentFragment();
        contactMessages.forEach((message) => {
            const card = makeElement("article", "local-message-card");
            const details = makeElement("div");
            details.append(makeElement("h4", "", message.subject));
            details.append(makeElement("p", "", `${message.name} · ${message.createdAt}`));
            details.append(makeElement("p", "local-message-content", message.message));
            const remove = makeElement("button", "remove-message-btn", "Delete");
            remove.type = "button";
            remove.dataset.messageId = message.id;
            remove.setAttribute("aria-label", `Delete saved message: ${message.subject}`);
            card.append(details, remove);
            fragment.append(card);
        });
        contactMessagesContainer.replaceChildren(fragment);
    }

    const savedPosts = readStorage(storageKeys.posts, []);
    const posts = Array.isArray(savedPosts)
        ? savedPosts.filter((post) =>
            post &&
            typeof post.id === "string" &&
            typeof post.content === "string" &&
            ["general", "announcement", "question"].includes(post.category)
        )
        : [];

    function savePosts() {
        return writeStorage(storageKeys.posts, posts);
    }

    function renderCommunityPosts() {
        const visiblePosts = posts
            .filter((post) => activePostFilter === "all" || post.category === activePostFilter)
            .slice()
            .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
        const fragment = document.createDocumentFragment();

        if (visiblePosts.length === 0) {
            const empty = makeElement("div", "feed-empty-state");
            const icon = makeElement("i");
            icon.className = "fas fa-comments";
            icon.setAttribute("aria-hidden", "true");
            empty.append(icon);
            empty.append(makeElement("strong", "", activePostFilter === "all" ? "Your feed is ready for its first update" : `No ${activePostFilter}s yet`));
            empty.append(makeElement("p", "", activePostFilter === "all"
                ? "Share an announcement, ask a question, or start a conversation."
                : "Try another filter or be the first to share one."));
            communityPosts.replaceChildren(empty);
            return;
        }

        visiblePosts.forEach((post) => {
            const card = makeElement("article", "community-post");
            const header = makeElement("div", "post-header");
            const avatar = makeElement("span", "post-avatar", "Y");
            avatar.setAttribute("aria-hidden", "true");
            const identity = makeElement("div");
            identity.append(makeElement("span", "post-author", post.author || "You"));
            const time = makeElement("time", "post-meta");
            const createdAt = new Date(post.createdAt);
            time.dateTime = Number.isNaN(createdAt.getTime()) ? "" : createdAt.toISOString();
            time.textContent = Number.isNaN(createdAt.getTime())
                ? "Saved on this device"
                : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(createdAt);
            identity.append(document.createTextNode(" · "), time);
            header.append(avatar, identity, makeElement("span", "post-category", post.category));

            const content = makeElement("p", "post-content", post.content);
            const actions = makeElement("div", "post-actions");
            const like = makeElement("button", "post-action");
            like.type = "button";
            like.dataset.postAction = "like";
            like.dataset.postId = post.id;
            like.setAttribute("aria-pressed", String(Boolean(post.liked)));
            like.setAttribute("aria-label", post.liked ? "Unlike your post" : "Like your post");
            const likeIcon = makeElement("i");
            likeIcon.className = `fa${post.liked ? "s" : "r"} fa-heart`;
            like.append(likeIcon, document.createTextNode(post.liked ? " Liked" : " Like"));

            const bookmark = makeElement("button", "post-action");
            bookmark.type = "button";
            bookmark.dataset.postAction = "bookmark";
            bookmark.dataset.postId = post.id;
            bookmark.setAttribute("aria-pressed", String(Boolean(post.bookmarked)));
            bookmark.setAttribute("aria-label", post.bookmarked ? "Remove saved post" : "Save post");
            const bookmarkIcon = makeElement("i");
            bookmarkIcon.className = `fa${post.bookmarked ? "s" : "r"} fa-bookmark`;
            bookmark.append(bookmarkIcon, document.createTextNode(post.bookmarked ? " Saved" : " Save"));
            actions.append(like, bookmark);
            card.append(header, content, actions);
            fragment.append(card);
        });

        communityPosts.replaceChildren(fragment);
    }

    postContent.addEventListener("input", () => {
        postCharacterCount.textContent = `${postContent.value.length} / 500`;
    });

    postComposer.addEventListener("submit", (event) => {
        event.preventDefault();
        const content = postContent.value.trim();
        if (!content) {
            showToast("Write a little something before sharing.", "error");
            postContent.focus();
            return;
        }

        const post = {
            id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            author: "You",
            content,
            category: postCategory.value,
            createdAt: new Date().toISOString(),
            liked: false,
            bookmarked: false
        };
        posts.unshift(post);
        if (!savePosts()) {
            posts.shift();
            return;
        }

        postComposer.reset();
        postCharacterCount.textContent = "0 / 500";
        activePostFilter = "all";
        document.querySelectorAll(".feed-filter").forEach((button) => {
            const active = button.dataset.postFilter === "all";
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });
        renderCommunityPosts();
        showToast("Your update has been saved in this browser.");
    });

    document.querySelector(".feed-filters").addEventListener("click", (event) => {
        const button = event.target.closest(".feed-filter");
        if (!button) return;
        activePostFilter = button.dataset.postFilter;
        document.querySelectorAll(".feed-filter").forEach((filterButton) => {
            const active = filterButton === button;
            filterButton.classList.toggle("active", active);
            filterButton.setAttribute("aria-pressed", String(active));
        });
        renderCommunityPosts();
    });

    communityPosts.addEventListener("click", (event) => {
        const button = event.target.closest("[data-post-action]");
        if (!button) return;
        const post = posts.find((item) => item.id === button.dataset.postId);
        if (!post) return;
        const property = button.dataset.postAction === "like" ? "liked" : "bookmarked";
        const previousValue = Boolean(post[property]);
        post[property] = !previousValue;
        if (!savePosts()) {
            post[property] = previousValue;
            return;
        }
        renderCommunityPosts();
    });

    renderCommunityPosts();

    function readInitialEvents() {
        return Array.from(eventContainer.querySelectorAll(".event-card")).map((card) => {
            const paragraphs = Array.from(card.querySelectorAll(".event-info > p"));
            const seatsText = card.querySelector(".available-seats span")?.textContent || "0";
            const seatCount = Number.parseInt(seatsText.replace(/\D/g, ""), 10) || 0;
            const name = card.querySelector("h3").textContent.trim();

            const event = {
                id: `initial-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
                name,
                category: card.dataset.category,
                description: card.querySelector(".event-description").textContent.trim(),
                dateLabel: paragraphs[1]?.textContent.trim() || "",
                time: paragraphs[2]?.textContent.trim() || "",
                venue: paragraphs[3]?.textContent.trim() || "",
                seats: seatCount,
                image: card.querySelector(":scope > img").src,
                card
            };
            card.dataset.eventId = event.id;
            card.querySelector(".register-btn").dataset.eventId = event.id;
            return event;
        });
    }

    const initialEvents = readInitialEvents();
    const storedEvents = readStorage(storageKeys.events, []);
    const savedEvents = Array.isArray(storedEvents) ? storedEvents : [];
    const events = new Map(initialEvents.map((event) => [event.id, event]));
    const storedHiddenEvents = readStorage(storageKeys.hiddenEvents, []);
    const hiddenEvents = new Set(Array.isArray(storedHiddenEvents) ? storedHiddenEvents : []);
    const storedRegistrations = readStorage(storageKeys.registrations, []);
    const registrations = Array.isArray(storedRegistrations) ? storedRegistrations : [];

    savedEvents.forEach((event) => {
        if (event && typeof event.id === "string" && typeof event.name === "string") {
            events.set(event.id, { ...event, custom: true });
        }
    });

    function visibleEvents() {
        return Array.from(events.values()).filter((event) => !hiddenEvents.has(event.id));
    }

    function saveEvents() {
        return writeStorage(
            storageKeys.events,
            Array.from(events.values()).filter((event) => event.custom)
        ) && writeStorage(storageKeys.hiddenEvents, Array.from(hiddenEvents));
    }

    function saveRegistrations() {
        return writeStorage(storageKeys.registrations, registrations);
    }

    function formatDate(date) {
        const parsedDate = new Date(`${date}T12:00:00`);
        return Number.isNaN(parsedDate.getTime())
            ? date
            : new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(parsedDate);
    }

    function createEventCard(event) {
        const card = makeElement("article", "event-card");
        card.dataset.category = event.category;
        card.dataset.eventId = event.id;

        const image = makeElement("img");
        image.src = event.image || "https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=600";
        image.alt = event.imageAlt || `${event.name} event`;
        image.loading = "lazy";
        card.append(image);

        const info = makeElement("div", "event-info");
        info.append(makeElement("span", "event-category", event.category));
        info.append(makeElement("h3", "", event.name));
        info.append(makeElement("p", "event-description", event.description));

        [
            ["fa-calendar", event.dateLabel || formatDate(event.date)],
            ["fa-clock", event.time],
            ["fa-location-dot", event.venue]
        ].forEach(([iconName, value]) => {
            const line = makeElement("p");
            const icon = makeElement("i");
            icon.className = `fas ${iconName}`;
            icon.setAttribute("aria-hidden", "true");
            line.append(icon, document.createTextNode(` ${value}`));
            info.append(line);
        });

        const seats = makeElement("p", "available-seats");
        const seatsIcon = makeElement("i");
        seatsIcon.className = "fas fa-users";
        seatsIcon.setAttribute("aria-hidden", "true");
        seats.append(seatsIcon, makeElement("span", "", `${remainingSeats(event)} Seats Available`));
        info.append(seats);

        const registerButton = makeElement("button", "register-btn", "Register Now");
        registerButton.type = "button";
        registerButton.dataset.eventId = event.id;
        info.append(registerButton);
        card.append(info);
        return card;
    }

    function remainingSeats(event) {
        const reserved = registrations.filter((registration) => registration.eventId === event.id).length;
        return Math.max(0, event.seats - reserved);
    }

    function refreshEventCards() {
        const activeCards = new Map();
        initialEvents.forEach((event) => {
            if (hiddenEvents.has(event.id)) {
                event.card.remove();
            } else {
                event.card.querySelector(".available-seats span").textContent =
                    `${remainingSeats(event)} Seats Available`;
                const button = event.card.querySelector(".register-btn");
                button.disabled = remainingSeats(event) === 0;
                button.textContent = button.disabled ? "Fully Booked" : "Register Now";
                activeCards.set(event.id, event.card);
            }
        });

        events.forEach((event) => {
            if (event.custom && !hiddenEvents.has(event.id)) {
                activeCards.set(event.id, createEventCard(event));
            }
        });

        eventContainer.replaceChildren(...activeCards.values());
        updateEventFilter();
        refreshEventOptions();
        renderManageEvents();
        updateDashboard();
    }

    function refreshEventOptions() {
        const selected = eventSelection.value;
        eventSelection.replaceChildren(new Option("Choose an Event", ""));
        visibleEvents().forEach((event) => {
            const option = new Option(event.name, event.id);
            if (remainingSeats(event) === 0) option.disabled = true;
            eventSelection.append(option);
        });
        if (visibleEvents().some((event) => event.id === selected)) {
            eventSelection.value = selected;
        }
    }

    function updateEventFilter() {
        const query = eventSearch.value.trim().toLowerCase();
        let visibleCount = 0;
        const cards = Array.from(eventContainer.querySelectorAll(".event-card"));

        cards.forEach((card) => {
            const event = events.get(card.dataset.eventId);
            const matchesCategory = activeCategory === "all" || card.dataset.category === activeCategory;
            const searchableText = `${event?.name || ""} ${event?.description || ""} ${event?.category || ""}`.toLowerCase();
            const matchesSearch = searchableText.includes(query);
            card.hidden = !matchesCategory || !matchesSearch;
            if (!card.hidden) visibleCount += 1;
        });

        const compareEvents = {
            featured: () => 0,
            name: (left, right) => left.name.localeCompare(right.name),
            date: (left, right) => {
                const leftDate = new Date(left.date || left.dateLabel).getTime();
                const rightDate = new Date(right.date || right.dateLabel).getTime();
                return (Number.isNaN(leftDate) ? Infinity : leftDate) -
                    (Number.isNaN(rightDate) ? Infinity : rightDate);
            },
            seats: (left, right) => remainingSeats(right) - remainingSeats(left)
        };
        const compare = compareEvents[eventSort.value] || compareEvents.featured;
        cards.sort((leftCard, rightCard) => {
            const leftEvent = events.get(leftCard.dataset.eventId);
            const rightEvent = events.get(rightCard.dataset.eventId);
            return leftEvent && rightEvent ? compare(leftEvent, rightEvent) : 0;
        });
        cards.forEach((card) => eventContainer.append(card));
        clearEventSearch.hidden = query.length === 0;

        document.querySelector("#event-results").textContent =
            `${visibleCount} ${visibleCount === 1 ? "event" : "events"} found`;
    }

    function renderRegistrations() {
        if (registrations.length === 0) {
            const empty = makeElement("div", "empty-message");
            const icon = makeElement("i");
            icon.className = "fas fa-calendar-check";
            icon.setAttribute("aria-hidden", "true");
            empty.append(icon, makeElement("h3", "", "No Registrations Yet"));
            empty.append(makeElement("p", "", "You haven't registered for any events. Explore upcoming activities and join the excitement!"));
            const explore = makeElement("a", "explore-btn", "Explore Events");
            explore.href = "#events";
            empty.append(explore);
            registrationsContainer.replaceChildren(empty);
            return;
        }

        const list = makeElement("div", "registrations-list");
        registrations.forEach((registration) => {
            const card = makeElement("article", "registration-card");
            card.dataset.registrationId = registration.id;
            card.append(makeElement("h3", "", registration.eventName));
            card.append(makeElement("p", "", `Registered by ${registration.studentName} · ${registration.registeredAt}`));
            card.append(makeElement("p", "", `${registration.department} · ${registration.email}`));
            const cancel = makeElement("button", "cancel-registration-btn", "Cancel registration");
            cancel.type = "button";
            cancel.dataset.registrationId = registration.id;
            card.append(cancel);
            list.append(card);
        });
        registrationsContainer.replaceChildren(list);
    }

    function eventDateInputValue(event) {
        if (event.date && /^\d{4}-\d{2}-\d{2}$/.test(event.date)) return event.date;
        const parsedDate = new Date(event.dateLabel);
        if (Number.isNaN(parsedDate.getTime())) return "";
        const year = parsedDate.getFullYear();
        const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
        const day = String(parsedDate.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function eventTimeInputValue(time) {
        const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!match) return "";
        let hour = Number(match[1]) % 12;
        if (match[3].toUpperCase() === "PM") hour += 12;
        return `${String(hour).padStart(2, "0")}:${match[2]}`;
    }

    function formatEventTime(time) {
        return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" })
            .format(new Date(`2000-01-01T${time}`));
    }

    function startEventEdit(eventId) {
        const event = events.get(eventId);
        if (!event) return;

        editingEventId = eventId;
        document.querySelector("#new-event-name").value = event.name;
        document.querySelector("#new-event-category").value = event.category;
        document.querySelector("#new-event-date").value = eventDateInputValue(event);
        document.querySelector("#new-event-time").value = eventTimeInputValue(event.time);
        document.querySelector("#new-event-venue").value = event.venue;
        document.querySelector("#new-event-seats").value = String(event.seats);
        document.querySelector("#new-event-description").value = event.description;
        document.querySelector("#new-event-image").value = event.image || "";
        eventFormSubmit.replaceChildren(
            document.createTextNode("Save Event Changes "),
            makeElement("i")
        );
        eventFormSubmit.querySelector("i").className = "fas fa-check";
        cancelEventEdit.hidden = false;
        eventForm.scrollIntoView({ behavior: "smooth", block: "center" });
        document.querySelector("#new-event-name").focus({ preventScroll: true });
    }

    function resetEventForm() {
        editingEventId = null;
        eventForm.reset();
        eventFormSubmit.replaceChildren(
            document.createTextNode("Add Event "),
            makeElement("i")
        );
        eventFormSubmit.querySelector("i").className = "fas fa-plus";
        cancelEventEdit.hidden = true;
    }

    function renderManageEvents() {
        const fragment = document.createDocumentFragment();
        const currentEvents = visibleEvents();

        if (currentEvents.length === 0) {
            manageEventsContainer.replaceChildren(makeElement("p", "", "No events to manage yet."));
            return;
        }

        currentEvents.forEach((event) => {
            const card = makeElement("article", "manage-event-card");
            const details = makeElement("div");
            details.append(makeElement("h4", "", event.name));
            details.append(makeElement("p", "", `${event.category} · ${event.dateLabel || formatDate(event.date)} · ${remainingSeats(event)} seats left`));
            card.append(details);
            const actions = makeElement("div", "manage-event-actions");
            const edit = makeElement("button", "edit-event-btn", "Edit");
            edit.type = "button";
            edit.dataset.eventId = event.id;
            edit.setAttribute("aria-label", `Edit ${event.name}`);
            const remove = makeElement("button", "remove-event-btn", "Remove");
            remove.type = "button";
            remove.dataset.eventId = event.id;
            remove.setAttribute("aria-label", `Remove ${event.name}`);
            actions.append(edit, remove);
            card.append(actions);
            fragment.append(card);
        });
        manageEventsContainer.replaceChildren(fragment);
    }

    function updateDashboard() {
        const currentEvents = visibleEvents();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = currentEvents.filter((event) => {
            const date = event.date ? new Date(`${event.date}T12:00:00`) : new Date(event.dateLabel);
            return !Number.isNaN(date.getTime()) && date >= today;
        }).length;

        document.querySelector("#total-events").textContent = String(currentEvents.length);
        document.querySelector("#total-students").textContent = String(registrations.length);
        document.querySelector("#upcoming-events").textContent = String(upcoming);
        document.querySelector("#available-seats").textContent = String(
            currentEvents.reduce((total, event) => total + remainingSeats(event), 0)
        );
    }

    function renderStudentRegistrations() {
        if (registrations.length === 0) {
            studentRegistrationsContainer.replaceChildren(makeElement("p", "", "No student registrations yet."));
            return;
        }

        const fragment = document.createDocumentFragment();
        registrations.forEach((registration) => {
            const card = makeElement("article", "student-registration-card");
            const details = makeElement("div");
            details.append(makeElement("h4", "", registration.studentName));
            details.append(makeElement("p", "", `${registration.eventName} · ${registration.email} · ${registration.department}`));
            card.append(details);
            fragment.append(card);
        });
        studentRegistrationsContainer.replaceChildren(fragment);
    }

    document.querySelector(".event-categories").addEventListener("click", (event) => {
        const button = event.target.closest(".category-btn");
        if (!button) return;

        activeCategory = button.dataset.category;
        document.querySelectorAll(".category-btn").forEach((categoryButton) => {
            const isActive = categoryButton === button;
            categoryButton.classList.toggle("active", isActive);
            categoryButton.setAttribute("aria-pressed", String(isActive));
        });
        updateEventFilter();
    });

    eventSearch.addEventListener("input", updateEventFilter);
    clearEventSearch.addEventListener("click", () => {
        eventSearch.value = "";
        eventSearch.focus();
        updateEventFilter();
    });
    eventSort.addEventListener("change", updateEventFilter);

    eventContainer.addEventListener("click", (event) => {
        const button = event.target.closest(".register-btn");
        if (!button) return;

        const selectedEvent = events.get(button.dataset.eventId);
        if (!selectedEvent) return;
        eventSelection.value = selectedEvent.id;
        registrationForm.scrollIntoView({ behavior: "smooth", block: "center" });
        document.querySelector("#student-name").focus({ preventScroll: true });
    });

    registrationForm.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!registrationForm.reportValidity()) return;

        const formData = new FormData(registrationForm);
        const selectedEvent = events.get(String(formData.get("event")));
        if (!selectedEvent || hiddenEvents.has(selectedEvent.id)) {
            showToast("Please choose an available event.", "error");
            return;
        }
        if (remainingSeats(selectedEvent) === 0) {
            showToast("Sorry, this event is full.", "error");
            refreshEventCards();
            return;
        }

        const email = String(formData.get("email")).trim().toLowerCase();
        if (registrations.some((registration) =>
            registration.eventId === selectedEvent.id && registration.email.toLowerCase() === email
        )) {
            showToast("This email is already registered for that event.", "error");
            return;
        }

        registrations.push({
            id: `registration-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            studentName: String(formData.get("studentName")).trim(),
            registrationNumber: String(formData.get("registrationNumber")).trim(),
            email,
            phone: String(formData.get("phone")).trim(),
            department: String(formData.get("department")),
            eventId: selectedEvent.id,
            eventName: selectedEvent.name,
            registeredAt: new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date())
        });

        if (!saveRegistrations()) {
            registrations.pop();
            return;
        }
        renderRegistrations();
        refreshEventCards();
        registrationForm.reset();
        showToast(`Your ${selectedEvent.name} registration is saved in this browser only.`);
    });

    eventForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!form.reportValidity()) return;

        const name = document.querySelector("#new-event-name").value.trim();
        const eventBeingEdited = editingEventId ? events.get(editingEventId) : null;
        if (!name) {
            showToast("Enter an event name.", "error");
            return;
        }
        if (visibleEvents().some((existingEvent) =>
            existingEvent.id !== editingEventId &&
            existingEvent.name.toLowerCase() === name.toLowerCase()
        )) {
            showToast("An event with that name already exists.", "error");
            return;
        }

        const date = document.querySelector("#new-event-date").value;
        const time = document.querySelector("#new-event-time").value;
        const category = document.querySelector("#new-event-category").value;
        const id = editingEventId || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const seats = Number(document.querySelector("#new-event-seats").value);
        const registeredCount = registrations.filter((registration) => registration.eventId === id).length;
        if (!Number.isInteger(seats) || seats < 1 || seats < registeredCount) {
            showToast(`Available seats must be a whole number and cannot be fewer than the ${registeredCount} existing registrations.`, "error");
            return;
        }

        const eventDetails = {
            id,
            name,
            category,
            date,
            dateLabel: formatDate(date),
            time: eventBeingEdited && eventTimeInputValue(eventBeingEdited.time) === time
                ? eventBeingEdited.time
                : formatEventTime(time),
            venue: document.querySelector("#new-event-venue").value.trim(),
            seats,
            description: document.querySelector("#new-event-description").value.trim(),
            image: document.querySelector("#new-event-image").value.trim() || "",
            custom: true
        };

        const previousEvent = eventBeingEdited ? { ...eventBeingEdited } : null;
        const previousRegistrationNames = registrations
            .filter((registration) => registration.eventId === id)
            .map((registration) => registration.eventName);
        events.set(id, eventDetails);
        if (!saveEvents()) {
            if (previousEvent) events.set(id, previousEvent);
            else events.delete(id);
            return;
        }

        if (eventBeingEdited && eventBeingEdited.name !== name) {
            registrations.forEach((registration) => {
                if (registration.eventId === id) registration.eventName = name;
            });
            if (!saveRegistrations()) {
                let nameIndex = 0;
                registrations.forEach((registration) => {
                    if (registration.eventId === id) {
                        registration.eventName = previousRegistrationNames[nameIndex];
                        nameIndex += 1;
                    }
                });
                events.set(id, previousEvent);
                saveEvents();
                return;
            }
        }

        resetEventForm();
        renderRegistrations();
        if (!studentRegistrationsContainer.hidden) renderStudentRegistrations();
        refreshEventCards();
        showToast(eventBeingEdited ? `${name} has been updated.` : `${name} has been added to the events list.`);
    });

    cancelEventEdit.addEventListener("click", resetEventForm);

    manageEventsContainer.addEventListener("click", (event) => {
        const editButton = event.target.closest(".edit-event-btn");
        if (editButton) {
            startEventEdit(editButton.dataset.eventId);
            return;
        }
        const button = event.target.closest(".remove-event-btn");
        if (!button) return;

        const eventId = button.dataset.eventId;
        if (registrations.some((registration) => registration.eventId === eventId)) {
            showToast("This event has registrations and can't be removed yet.", "error");
            return;
        }

        hiddenEvents.add(eventId);
        const removedEvent = events.get(eventId);
        if (removedEvent?.custom) events.delete(eventId);
        if (!saveEvents()) {
            hiddenEvents.delete(eventId);
            if (removedEvent) events.set(eventId, removedEvent);
            return;
        }
        refreshEventCards();
        showToast("The event has been removed.");
    });

    registrationsContainer.addEventListener("click", (event) => {
        const button = event.target.closest(".cancel-registration-btn");
        if (!button) return;

        const index = registrations.findIndex((registration) => registration.id === button.dataset.registrationId);
        if (index === -1) return;
        const [removedRegistration] = registrations.splice(index, 1);
        if (!saveRegistrations()) {
            registrations.splice(index, 0, removedRegistration);
            return;
        }
        renderRegistrations();
        refreshEventCards();
        showToast("Your registration has been cancelled.");
    });

    document.querySelector("#view-student-registrations").addEventListener("click", (event) => {
        const button = event.currentTarget;
        const isExpanded = button.getAttribute("aria-expanded") === "true";
        if (!isExpanded) renderStudentRegistrations();
        studentRegistrationsContainer.hidden = isExpanded;
        button.setAttribute("aria-expanded", String(!isExpanded));
        button.textContent = isExpanded ? "View Student Registrations" : "Hide Student Registrations";
    });

    renderContactMessages();

    document.querySelector("#contact-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!form.reportValidity()) return;
        const message = {
            id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: document.querySelector("#contact-name").value.trim(),
            email: document.querySelector("#contact-email").value.trim().toLowerCase(),
            subject: document.querySelector("#contact-subject").value.trim(),
            message: document.querySelector("#contact-message").value.trim(),
            createdAt: new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date())
        };
        if (!message.name || !message.subject || !message.message) {
            showToast("Please complete each contact field.", "error");
            return;
        }
        contactMessages.unshift(message);
        if (!saveContactMessages()) {
            contactMessages.shift();
            return;
        }
        renderContactMessages();
        form.reset();
        showToast("Your message is saved on this device only; it hasn't been delivered.");
    });

    contactMessagesContainer.addEventListener("click", (event) => {
        const button = event.target.closest(".remove-message-btn");
        if (!button) return;
        const index = contactMessages.findIndex((message) => message.id === button.dataset.messageId);
        if (index === -1) return;
        const [removedMessage] = contactMessages.splice(index, 1);
        if (!saveContactMessages()) {
            contactMessages.splice(index, 0, removedMessage);
            return;
        }
        renderContactMessages();
        showToast("The saved message has been deleted.");
    });

    document.querySelector("#signup-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!form.reportValidity()) return;
        const name = document.querySelector("#signup-name").value.trim();
        const email = document.querySelector("#signup-email").value.trim().toLowerCase();
        const password = document.querySelector("#signup-password").value;
        if (!name) {
            showToast("Enter your full name.", "error");
            return;
        }
        if (password !== document.querySelector("#confirm-password").value) {
            showToast("Your passwords don't match. Please try again.", "error");
            document.querySelector("#confirm-password").focus();
            return;
        }
        if (accounts.some((account) => account.email === email)) {
            showToast("A browser-only account already exists for that email.", "error");
            return;
        }

        try {
            const randomSalt = window.crypto.getRandomValues(new Uint8Array(16));
            const salt = Array.from(randomSalt, (byte) => byte.toString(16).padStart(2, "0")).join("");
            const account = {
                id: `account-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name,
                email,
                passwordSalt: salt,
                passwordHash: await derivePasswordHash(password, salt)
            };
            accounts.push(account);
            if (!writeStorage(storageKeys.accounts, accounts)) {
                accounts.pop();
                return;
            }
            if (!writeStorage(storageKeys.session, { userId: account.id })) return;
            updateAccountUI(account);
            form.reset();
            showToast("Your browser-only demo account is ready on this device.");
        } catch (error) {
            console.error("Unable to create a local CampusConnect account.", error);
            showToast("Your local account could not be created in this browser.", "error");
        }
    });

    document.querySelector("#login-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!form.reportValidity()) return;
        const email = document.querySelector("#login-email").value.trim().toLowerCase();
        const password = document.querySelector("#login-password").value;
        const account = accounts.find((item) => item.email === email);
        if (!account) {
            showToast("No browser-only account was found for that email.", "error");
            return;
        }

        try {
            const passwordHash = await derivePasswordHash(password, account.passwordSalt);
            if (!passwordsMatch(passwordHash, account.passwordHash)) {
                showToast("The email or password is incorrect.", "error");
                return;
            }
            if (!writeStorage(storageKeys.session, { userId: account.id })) return;
            updateAccountUI(account);
            form.reset();
            showToast(`Welcome back, ${account.name}.`);
        } catch (error) {
            console.error("Unable to sign in to a local CampusConnect account.", error);
            showToast("Local sign-in is unavailable in this browser.", "error");
        }
    });

    logoutButton.addEventListener("click", () => {
        try {
            localStorage.removeItem(storageKeys.session);
        } catch (error) {
            console.error("Unable to clear the CampusConnect local session.", error);
            showToast("You couldn't be signed out because browser storage is unavailable.", "error");
            return;
        }
        updateAccountUI(null);
        showToast("You have been signed out on this device.");
    });

    const menuToggle = document.querySelector(".menu-toggle");
    const navLinks = document.querySelector(".nav-links");
    const appSidebar = document.querySelector(".app-sidebar");
    const sidebarNavLinks = Array.from(navLinks.querySelectorAll("a"));

    function setActiveNavigationLink(activeLink) {
        sidebarNavLinks.forEach((link) => {
            const active = link === activeLink;
            link.classList.toggle("active", active);
            if (active) {
                link.setAttribute("aria-current", "location");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    }

    const sectionVisibility = new Map();
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => sectionVisibility.set(entry.target.id, entry.isIntersecting));
        const visibleSection = sidebarNavLinks
            .map((link) => ({ link, visible: sectionVisibility.get(link.hash.slice(1)) }))
            .find((item) => item.visible);
        if (visibleSection) setActiveNavigationLink(visibleSection.link);
    }, { rootMargin: "-25% 0px -65% 0px" });

    sidebarNavLinks.forEach((link) => {
        const section = document.querySelector(link.hash);
        if (section) sectionObserver.observe(section);
    });

    function closeMobileNavigation() {
        navLinks.classList.remove("active");
        appSidebar.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Open navigation");
        menuToggle.querySelector("i").className = "fas fa-bars";
    }

    menuToggle.addEventListener("click", () => {
        const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
        menuToggle.setAttribute("aria-expanded", String(!isExpanded));
        menuToggle.setAttribute("aria-label", isExpanded ? "Open navigation" : "Close navigation");
        menuToggle.querySelector("i").className = isExpanded ? "fas fa-bars" : "fas fa-xmark";
        navLinks.classList.toggle("active", !isExpanded);
        appSidebar.classList.toggle("is-open", !isExpanded);
    });

    navLinks.addEventListener("click", (event) => {
        const link = event.target.closest("a");
        if (!link) return;
        setActiveNavigationLink(link);
        closeMobileNavigation();
    });

    refreshEventCards();
    renderRegistrations();
    studentRegistrationsContainer.hidden = true;
});