-- Repair migration for the deployed database, which missed the key columns from 0002.
ALTER TABLE `partnerships` ADD `userPublicKey` text;
ALTER TABLE `partnerships` ADD `partnerPublicKey` text;
