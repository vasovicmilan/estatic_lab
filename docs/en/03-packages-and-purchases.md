# Packages & Package Purchases

## What a Package is

A **Package** is a bundle offer: multiple sessions of one or more services, sold together at a price lower than buying each session separately. This is a standard wellness-industry pricing model — a customer who commits to 10 sessions upfront pays less per session than someone booking one at a time, in exchange for paying the whole amount before using any of it.

A Package can bundle sessions of a single service (e.g., "10 sessions of a specific treatment") or combine several different services into one offer (e.g., a mixed program covering more than one type of treatment).

## How a customer gets a Package

Because package purchases involve a real upfront payment collected outside the platform (in person, by bank transfer, and so on), an administrator records the purchase on the customer's behalf once payment has actually been received. At that point, the admin can also apply a discount code, if the customer is entitled to one — the system shows the resulting final price before the purchase is finalized, so there's no guesswork about what the customer is actually being charged.

## Spending sessions from a Package

Once a customer holds a Package, booking an appointment for one of the included services lets them choose to use one of their remaining sessions instead of paying again. The system tracks, per service included in the package: how many sessions were purchased in total, how many have been used, and how many are currently reserved (booked but not yet completed, so they can be released back if the appointment falls through).

## Why the per-session value of a package still matters internally

Even though the customer isn't charged anything new when they use a package session, the business still needs an accurate internal answer to a real question: **what is that specific session actually worth**, for purposes like calculating staff commission (see `07-employee-compensation.md`)? A package's bundle price doesn't say, by itself, how much of that price corresponds to any one individual service or session — especially when a package mixes several different services together.

The system resolves this by recording, at the moment a package is purchased, exactly what each included service's normal per-session price was at that time, and how much of a discount the whole bundle represents compared to buying everything separately. That combination — the real per-session value, and the actual bundle discount rate — is what lets the business correctly and fairly value each session as it gets used later, without needing to guess or apply a flat number regardless of which service was actually performed.

## Cancelling a Package

A package purchase can be cancelled if needed — for example, if a customer requests a refund shortly after purchasing. Cancellation correctly unwinds anything that was tied to that purchase, including reversing any commission that had already been credited as a result of it.
